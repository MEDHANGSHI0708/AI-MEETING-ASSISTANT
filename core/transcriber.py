import whisper
import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydub import AudioSegment

# Sarvam's sync STT-translate API rejects audio longer than 30s.
# We slice each chunk into 25s pieces (with a 5s safety margin) before sending.
SARVAM_PIECE_SECONDS = 25


WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")


SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_STT_TRANSLATE_URL = "https://api.sarvam.ai/speech-to-text-translate"
SARVAM_MODEL = os.getenv("SARVAM_STT_MODEL", "saaras:v2.5")

_model = None


def load_model():
    global _model  

    if _model is None: 
        print(f"Loading Whisper model: {WHISPER_MODEL} ...")
        _model = whisper.load_model(WHISPER_MODEL) 
        print("Whisper model loaded.")
    return _model 


def transcribe_chunk_whisper(chunk_path: str) -> str:
    model = load_model()  
    result = model.transcribe(chunk_path, task="transcribe")  
    return result["text"]  


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
    if language.lower() == "hinglish":
        return transcribe_chunk_sarvam(chunk_path)
    return transcribe_chunk_whisper(chunk_path)


def transcribe_all(chunks: list, language: str = "english") -> str:
    full_transcript = "" 
    engine = "Sarvam AI (Parallel)" if language.lower() == "hinglish" else "Whisper"
    print(f"Using {engine} for transcription.")

    for i, chunk in enumerate(chunks):  
        print(f"Transcribing chunk {i + 1}/{len(chunks)}...")
        text = transcribe_chunk(chunk, language=language)  
        full_transcript += text + " "  

    print("Transcription complete.")
    return full_transcript.strip()
  

