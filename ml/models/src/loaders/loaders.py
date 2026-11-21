from yaml import safe_load, YAMLError
from pathlib import Path
from typing import Any


def load_yaml_file(path: str | Path) -> Any:
    """
    Safely load a YAML file.

    Args:
        path: Path to the YAML file

    Returns:
        Parsed YAML content as Python objects

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If YAML is invalid or empty
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"YAML file not found: {path}")

    try:
        with path.open("r", encoding="utf-8") as f:
            data = safe_load(f)
    except YAMLError as e:
        raise ValueError(f"Invalid YAML format: {e}") from e

    if data is None:
        raise ValueError("YAML file is empty")

    return data
