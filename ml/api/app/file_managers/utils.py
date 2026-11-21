from pathlib import Path
from pandas import DataFrame, read_csv


def load_csv_as_df(path: str | Path) -> DataFrame:
    """
    Load a CSV file into a pandas DataFrame.

    Args:
        path: Path to the CSV file as a string or pathlib.Path.

    Returns:
        A pandas DataFrame containing the CSV data.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the path is not a CSV file.
    """
    csv_path = Path(path)

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    if csv_path.suffix.lower() != ".csv":
        raise ValueError(f"Expected a .csv file, got: {csv_path}")

    return read_csv(csv_path)
