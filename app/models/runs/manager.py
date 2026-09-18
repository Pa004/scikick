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


MANIFEST_NAME = "manifest.json"


def write_manifest(run_dir: str | Path, entry: dict) -> Path:
    """Atomically record the latest artifacts. Readers prefer this over globs."""
    root = Path(run_dir)
    root.mkdir(parents=True, exist_ok=True)
    manifest_path = root / MANIFEST_NAME
    tmp_path = root / f"{MANIFEST_NAME}.tmp"
    tmp_path.write_text(json.dumps(entry, indent=2, default=str), encoding="utf-8")
    tmp_path.replace(manifest_path)
    return manifest_path


def _glob_latest(root: Path, pattern: str) -> Path | None:
    files = sorted(
        root.glob(pattern),
        key=lambda p: (p.stat().st_mtime, p.name),
        reverse=True,
    )
    return files[0] if files else None


def resolve_latest(run_dir: str | Path) -> dict[str, Path | None]:
    """Manifest-first artifact resolution with mtime-glob fallback.

    Returns {"pipeline": Path | None, "ensemble": Path | None}. A corrupt
    or stale manifest (missing files) falls back to globs instead of
    silently serving the wrong model.
    """
    root = Path(run_dir)
    if root.exists():
        try:
            manifest = json.loads((root / MANIFEST_NAME).read_text(encoding="utf-8"))
            pipe = root / manifest["pipeline_file"]
            ens_name = manifest.get("ensemble_file")
            ens = root / ens_name if ens_name else None
            if pipe.exists() and (ens is None or ens.exists()):
                return {"pipeline": pipe, "ensemble": ens}
        except (OSError, ValueError, KeyError, TypeError):
            pass
    return {
        "pipeline": _glob_latest(root, "pipeline_*.json") if root.exists() else None,
        "ensemble": _glob_latest(root, "ensemble_*.joblib") if root.exists() else None,
    }
