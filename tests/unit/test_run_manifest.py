from __future__ import annotations

import json
import time
from pathlib import Path

from app.models.runs.manager import resolve_latest, write_manifest


def _touch(path: Path) -> None:
    path.write_text("{}", encoding="utf-8")


def test_manifest_preferred_over_newer_stray_file(tmp_path: Path) -> None:
    run_dir = tmp_path / "E0"
    run_dir.mkdir()
    old_pipe = run_dir / "pipeline_complete_20200101_000000.json"
    old_ens = run_dir / "ensemble_20200101_000000.joblib"
    _touch(old_pipe)
    _touch(old_ens)
    new_pipe = run_dir / "pipeline_complete_20300101_000000.json"
    _touch(new_pipe)
    # Newer mtime on the stray file, but the manifest pins the run.
    now = time.time() + 1000
    import os

    os.utime(new_pipe, (now, now))
    write_manifest(run_dir, {
        "run_id": str(old_pipe),
        "league": "E0",
        "mode": "complete",
        "pipeline_file": old_pipe.name,
        "ensemble_file": old_ens.name,
    })
    resolved = resolve_latest(run_dir)
    assert resolved["pipeline"] == old_pipe
    assert resolved["ensemble"] == old_ens


def test_corrupt_manifest_falls_back_to_glob(tmp_path: Path) -> None:
    run_dir = tmp_path / "E0"
    run_dir.mkdir()
    pipe = run_dir / "pipeline_complete_20200101_000000.json"
    _touch(pipe)
    (run_dir / "manifest.json").write_text("not-json{{{", encoding="utf-8")
    resolved = resolve_latest(run_dir)
    assert resolved["pipeline"] == pipe
    assert resolved["ensemble"] is None


def test_missing_dir_resolves_to_nones(tmp_path: Path) -> None:
    resolved = resolve_latest(tmp_path / "nope")
    assert resolved == {"pipeline": None, "ensemble": None}


def test_manifest_round_trip(tmp_path: Path) -> None:
    run_dir = tmp_path / "E0"
    entry = {"run_id": "x", "pipeline_file": "p.json"}
    path = write_manifest(run_dir, entry)
    assert path.exists()
    assert json.loads(path.read_text(encoding="utf-8"))["run_id"] == "x"
