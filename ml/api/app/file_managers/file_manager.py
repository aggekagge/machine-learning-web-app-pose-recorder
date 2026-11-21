from pathlib import Path
from typing import Union


class FileManager:
    """
    Manages storage and retrieval of files in a specified directory.
    """

    def __init__(self, directory: str):
        self.base_path = Path(directory)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, filename: str) -> Path:
        return self.base_path / filename

    def save_file(self, filename: str, content: Union[str, bytes]) -> Path:
        """
        Saves a file to the directory.

        Args:
            filename: Name of the file.
            content: File content (str or bytes).

        Returns:
            Path to the saved file.
        """
        file_path = self._resolve_path(filename)

        if isinstance(content, bytes):
            file_path.write_bytes(content)
        else:
            file_path.write_text(content, encoding="utf-8")

        return file_path

    def load_file(
            self,
            filename: str,
            as_bytes: bool = False
    ) -> Union[str, bytes]:
        """
        Loads a file from the directory.

        Args:
            filename: Name of the file.
            as_bytes: If True, returns bytes instead of text.

        Returns:
            File content.
        """
        file_path = self._resolve_path(filename)

        if not file_path.exists():
            raise FileNotFoundError(f"File '{filename}' not found")

        if as_bytes:
            return file_path.read_bytes()
        return file_path.read_text(encoding="utf-8")

    def list_files(self) -> list[str]:
        """
        Lists all files in the directory.

        Returns:
            List of filenames.
        """
        return sorted(
            file.name
            for file in self.base_path.iterdir()
            if file.is_file()
        )

    def file_exists(self, filename: str) -> bool:
        """
        Checks if a file exists.
        """
        return self._resolve_path(filename).exists()
