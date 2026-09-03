from __future__ import annotations

import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

import numpy as np


def compute_dataset_hash(X: np.ndarray, y: np.ndarray | None = None) -> str:
    h = hashlib.sha256(X.tobytes())
    if y is not None:
        h.update(y.tobytes())
    return h.hexdigest()[:16]


def save_run(
    run_dir: str | Path,
    model_type: str,
    params: dict,
    metrics: dict,
    X: np.ndarray,
    y: np.ndarray | None = None,
) -> Path:
    run_path = Path(run_dir)
    run_path.mkdir(parents=True, exist_ok=True)

    dataset_hash = compute_dataset_hash(X, y)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_name = f"{model_type}_{timestamp}_{dataset_hash}"

    run_data = {
        "run_name": run_name,
        "model_type": model_type,
        "params": params,
        "metrics": metrics,
        "dataset_hash": dataset_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    run_file = run_path / f"{run_name}.json"
    run_file.write_text(json.dumps(run_data, indent=2, default=str), encoding="utf-8")
    return run_file


def load_run(run_file: str | Path) -> dict:
    return json.loads(Path(run_file).read_text(encoding="utf-8"))


def list_runs(run_dir: str | Path) -> list[dict]:
    run_path = Path(run_dir)
    if not run_path.exists():
        return []
    return [load_run(f) for f in sorted(run_path.glob("*.json"))]


def get_latest_run(run_dir: str | Path) -> dict | None:
    runs = list_runs(run_dir)
    return runs[-1] if runs else None
