"""In-memory progress registry for long-running meeting jobs.

The processing endpoint is a single blocking request, so it cannot report
progress through its own response. The client generates a job id, sends it with
the request, and polls a side channel while the work runs. FastAPI runs the sync
processing handler in a worker thread, so the poll is served concurrently.

State is per-process and deliberately not persisted: progress is only meaningful
while the request that produces it is still in flight.
"""

import threading
import time
from typing import Any, Dict, Optional

_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}

# Entries are dropped after this long so an abandoned job cannot leak memory.
_TTL_SECONDS = 3600


def _prune_locked() -> None:
    cutoff = time.time() - _TTL_SECONDS
    for key in [k for k, v in _jobs.items() if v["updated_at"] < cutoff]:
        del _jobs[key]


def update(
    job_id: Optional[str],
    stage: str,
    percent: Optional[float] = None,
    detail: str = "",
) -> None:
    """Records the current stage of a job.

    A missing job_id is a no-op, so every pipeline function stays callable from
    the CLI, from tests, and from callers that do not care about progress.
    `percent` stays None for stages whose completion cannot be measured.
    """
    if not job_id:
        return
    with _lock:
        _prune_locked()
        _jobs[job_id] = {
            "stage": stage,
            "percent": None if percent is None else max(0.0, min(100.0, float(percent))),
            "detail": detail,
            "updated_at": time.time(),
        }


def get(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def clear(job_id: Optional[str]) -> None:
    if not job_id:
        return
    with _lock:
        _jobs.pop(job_id, None)


def format_bytes(num: Optional[float]) -> str:
    if not num:
        return "?"
    step = 1024.0
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num) < step or unit == "GB":
            return f"{num:.1f} {unit}" if unit != "B" else f"{int(num)} B"
        num /= step
    return f"{num:.1f} GB"
