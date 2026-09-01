import numpy as np

from app.models.runs.manager import save_run, load_run, list_runs, get_latest_run, compute_dataset_hash


def test_compute_dataset_hash():
    X = np.array([[1, 2], [3, 4]])
    h = compute_dataset_hash(X)
    assert len(h) == 16


def test_save_and_load_run(tmp_path):
    X = np.array([[1, 2], [3, 4]])
    y = np.array([0, 1])
    run_file = save_run(tmp_path, "test_model", {"lr": 0.05}, {"brier": 0.2}, X, y)
    assert run_file.exists()

    loaded = load_run(run_file)
    assert loaded["model_type"] == "test_model"
    assert loaded["params"]["lr"] == 0.05


def test_list_runs(tmp_path):
    X = np.array([[1, 2]])
    save_run(tmp_path, "model_a", {}, {"brier": 0.3}, X)
    save_run(tmp_path, "model_b", {}, {"brier": 0.2}, X)
    runs = list_runs(tmp_path)
    assert len(runs) == 2


def test_get_latest_run(tmp_path):
    X = np.array([[1, 2]])
    save_run(tmp_path, "first", {}, {"brier": 0.3}, X)
    save_run(tmp_path, "second", {}, {"brier": 0.2}, X)
    latest = get_latest_run(tmp_path)
    assert latest["model_type"] == "second"
