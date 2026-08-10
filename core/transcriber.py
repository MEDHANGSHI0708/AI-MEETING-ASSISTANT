import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
from pydub import AudioSegment

from dotenv import load_dotenv

from utils import progress

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")

def get_groq_api_key() -> str:
    load_dotenv(override=True)
    raw_key = os.getenv("GROQ_API_KEY", "")
    return raw_key.strip().strip('"').strip("'")

# Sarvam STT Configuration
SARVAM_PIECE_SECONDS = 25
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_STT_TRANSLATE_URL = "https://api.sarvam.ai/speech-to-text-translate"
SARVAM_MODEL = os.getenv("SARVAM_STT_MODEL", "saaras:v2.5")


GROQ_MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB safety limit for Groq's 25 MB payload cap


def _send_single_groq_request(piece_path: str, api_key: str) -> str:
    headers = {"Authorization": f"Bearer {api_key}"}
    with open(piece_path, "rb") as f:
        files = {"file": (os.path.basename(piece_path), f)}
        data = {
            "model": GROQ_MODEL,
            "response_format": "json",
            "temperature": 0.0,
        }
        response = requests.post(
            GROQ_STT_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=120,
        )

    if not response.ok:
        print(f"\n[ERROR] Groq STT API returned {response.status_code}")
        print(f"Response body: {response.text}\n")
        response.raise_for_status()

    res_json = response.json()
    return res_json.get("text", "")


def transcribe_chunk_groq(chunk_path: str) -> str:
    """
    Transcribes an audio chunk using Groq's high-speed Whisper Cloud API.
    Automatically sub-chunks oversized files (>20MB) to satisfy Groq's 25MB payload limit.
    """
    api_key = get_groq_api_key()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set in environment or .env file.")

    # Check file size. If larger than 20 MB, slice into 5-minute MP3 pieces
    file_size = os.path.getsize(chunk_path)
    if file_size > GROQ_MAX_FILE_BYTES:
        print(f"  → Chunk file size ({file_size / (1024*1024):.1f} MB) exceeds 20MB threshold. Auto sub-chunking for Groq API...")
        audio = AudioSegment.from_file(chunk_path)
        piece_ms = 5 * 60 * 1000  # 5 minutes
        sub_texts = []
        for i, start in enumerate(range(0, len(audio), piece_ms)):
            piece = audio[start: start + piece_ms]
            piece_path = f"{chunk_path}_sub_{i}.mp3"
            piece.export(piece_path, format="mp3", bitrate="128k")
            try:
                txt = _send_single_groq_request(piece_path, api_key)
                if txt:
                    sub_texts.append(txt)
            finally:
                if os.path.exists(piece_path):
                    try:
                        os.remove(piece_path)
                    except Exception:
                        pass
        return " ".join(sub_texts).strip()

    return _send_single_groq_request(chunk_path, api_key)


def transcribe_chunk_whisper(chunk_path: str) -> str:
    """Alias for transcribe_chunk_groq for backward compatibility."""
    return transcribe_chunk_groq(chunk_path)


def _send_to_sarvam(piece_path: str) -> str:
    """Send one ≤30s WAV file to Sarvam with diarization enabled."""
    headers = {"api-subscription-key": SARVAM_API_KEY}

    with open(piece_path, "rb") as f:
        files = {"file": (os.path.basename(piece_path), f, "audio/wav")}
        data = {"model": SARVAM_MODEL, "with_diarization": "true"}
        response = requests.post(
            SARVAM_STT_TRANSLATE_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=120,
        )

    if not response.ok:
        print(f"\n❌ Sarvam returned {response.status_code}")
        print(f"Response body: {response.text}\n")
        response.raise_for_status()

    res_json = response.json()
    transcript = res_json.get("transcript", "")
    return transcript


def _process_single_piece(args) -> tuple[int, str]:
    """Helper to send a piece and retain index position."""
    index, piece_path = args
    try:
        text = _send_to_sarvam(piece_path)
        return index, text
    finally:
        if os.path.exists(piece_path):
            try:
                os.remove(piece_path)
            except Exception:
                pass


def transcribe_chunk_sarvam(chunk_path: str, max_workers: int = 8) -> str:
    """
    Splits chunk into 25-second pieces and transcribes them IN PARALLEL
    using ThreadPoolExecutor for 80%+ speedup.
    """
    if not SARVAM_API_KEY:
        raise RuntimeError("SARVAM_API_KEY is not set in environment / .env")

    audio = AudioSegment.from_wav(chunk_path)
    piece_ms = SARVAM_PIECE_SECONDS * 1000

    piece_args = []
    total_pieces = (len(audio) + piece_ms - 1) // piece_ms

    for i, start in enumerate(range(0, len(audio), piece_ms)):
        piece = audio[start: start + piece_ms]
        piece_path = f"{chunk_path}_sv_{i}.wav"
        piece.export(piece_path, format="wav")
        piece_args.append((i, piece_path))

    print(f"  → Transcribing {total_pieces} Sarvam pieces in parallel ({max_workers} threads)...")

    results = [None] * len(piece_args)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_process_single_piece, arg) for arg in piece_args]
        for future in as_completed(futures):
            idx, text = future.result()
            results[idx] = text

    return " ".join(filter(None, results)).strip()


def transcribe_chunk(chunk_path: str, language: str = "english") -> str:
    if language.lower() == "hinglish" and os.getenv("SARVAM_API_KEY"):
        return transcribe_chunk_sarvam(chunk_path)
    return transcribe_chunk_groq(chunk_path)


def transcribe_all(chunks: list, language: str = "english", job_id: Optional[str] = None) -> str:
    full_transcript = ""
    engine = "Sarvam AI (Parallel)" if (language.lower() == "hinglish" and os.getenv("SARVAM_API_KEY")) else f"Groq Cloud API ({GROQ_MODEL})"
    print(f"Using {engine} for transcription.")

    total = len(chunks)
    for i, chunk in enumerate(chunks):
        print(f"Transcribing chunk {i + 1}/{total}...")
        # Reported before the call, so the bar reflects work started rather than
        # jumping only once a slow chunk returns.
        progress.update(job_id, "transcribe", (i / total) * 100, f"Part {i + 1} of {total}")
        text = transcribe_chunk(chunk, language=language)
        full_transcript += text + " "

    progress.update(job_id, "transcribe", 100.0, f"{total} part(s) done")
    print("Transcription complete.")
    return full_transcript.strip()

  

