import yt_dlp
from pydub import AudioSegment
import os
from typing import Optional

from utils import progress

DOWNLOAD_DIR = 'downloades'
os.makedirs(DOWNLOAD_DIR,exist_ok = True)

def download_youtube_audio(url: str, job_id: Optional[str] = None) -> str:
    url = url.strip()
    output_path = os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s")

    def report(status: dict) -> None:
        """yt-dlp progress hook. Reports real transferred bytes, not a guess."""
        if status.get("status") == "downloading":
            # total_bytes is exact; total_bytes_estimate is yt-dlp's estimate for
            # streams that do not advertise a length. Either gives a real ratio.
            total = status.get("total_bytes") or status.get("total_bytes_estimate")
            done = status.get("downloaded_bytes") or 0
            speed = status.get("speed")
            detail = f"{progress.format_bytes(done)} of {progress.format_bytes(total)}"
            if speed:
                detail += f" · {progress.format_bytes(speed)}/s"
            progress.update(
                job_id,
                "download",
                (done / total * 100) if total else None,
                detail,
            )
        elif status.get("status") == "finished":
            progress.update(job_id, "download", 100.0, "Download complete")

    def report_postprocess(status: dict) -> None:
        if status.get("status") == "started":
            progress.update(job_id, "convert", None, "Extracting audio track")

    progress.update(job_id, "download", None, "Contacting source")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "nocheckcertificate": True,
        "quiet": True,
        "socket_timeout": 30,
        "retries": 5,
        "fragment_retries": 5,
        "progress_hooks": [report],
        "postprocessor_hooks": [report_postprocess],
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web"]
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        base_name = ydl.prepare_filename(info)
        filename = os.path.splitext(base_name)[0] + ".wav"
    return filename



def convert_to_wav(input_path: str, job_id: Optional[str] = None) -> str:
    """Convert any audio/video file to WAV format using pydub."""
    progress.update(job_id, "convert", None, os.path.basename(input_path))
    output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    audio = AudioSegment.from_file(input_path)
    audio = audio.set_channels(1).set_frame_rate(16000) #16khz
    audio.export(output_path, format="wav")
    return output_path



def chunk_audio(wav_path : str , chunk_minutes : int = 5, job_id: Optional[str] = None) -> list:
    audio = AudioSegment.from_file(wav_path)
    chunk_ms = chunk_minutes * 60 * 1000

    starts = list(range(0, len(audio), chunk_ms))
    total = len(starts)
    chunks = []

    for i, start in enumerate(starts):
        progress.update(job_id, "chunk", (i / total) * 100, f"Part {i + 1} of {total}")
        chunk = audio[start : start + chunk_ms]
        chunk_path = f"{wav_path}_chunk_{i}.mp3"
        chunk.export(chunk_path, format="mp3", bitrate="128k")

        chunks.append(chunk_path)

    return chunks

def process_input(source: str, job_id: Optional[str] = None) -> list:
    if source.startswith("http://") or source.startswith("https://"):
        print("Detected YouTube URL. Downloading audio...")
        wav_path = download_youtube_audio(source, job_id=job_id)
    else:
        print("Detected local file. Converting to WAV...")
        wav_path = convert_to_wav(source, job_id=job_id)

    print("Chunking audio...")
    chunks = chunk_audio(wav_path, job_id=job_id)
    print(f"Audio ready — {len(chunks)} chunk(s) created.")
    return chunks


def cleanup_chunks(chunk_paths: list) -> None:
    """Deletes temporary WAV chunks and downloaded files after transcription completes."""
    print("Cleaning up temporary audio files...")
    for path in chunk_paths:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"Could not remove {path}: {e}")

        # Also remove parent converted wav if applicable
        parent_wav = path.split("_chunk_")[0]
        if parent_wav != path and os.path.exists(parent_wav):
            try:
                os.remove(parent_wav)
            except Exception:
                pass
    print("Cleanup complete.")


