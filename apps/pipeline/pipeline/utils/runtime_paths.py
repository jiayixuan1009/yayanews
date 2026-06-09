"""Runtime filesystem locations for the Python pipeline."""
import os
from pathlib import Path


PIPELINE_APP_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = PIPELINE_APP_ROOT.parents[1]


def get_pipeline_data_dir() -> Path:
    """Return the directory used for mutable pipeline runtime files."""
    configured = os.getenv("PIPELINE_DATA_DIR", "").strip()
    if configured:
        data_dir = Path(configured).expanduser()
        if not data_dir.is_absolute():
            data_dir = PIPELINE_APP_ROOT / data_dir
    else:
        data_dir = PIPELINE_APP_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir.resolve()


def pipeline_runtime_file(name: str) -> Path:
    return get_pipeline_data_dir() / name
