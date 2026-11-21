from app.core.registry_instance import registry, deep_registry
from app.core.model_registry import Registry
from app.core.deep_model_registry import DeepModelRegistry
from app.file_managers.file_manager import FileManager


csv_manager = FileManager("data/extracted_keypoints")


def get_registry() -> Registry:
    """
    Provides access to the global model registry instance.
    Useful for dependency injection or retrieving the
    registry in other modules.
    """
    return registry


def get_deep_registry() -> DeepModelRegistry:
    """
    Provides access to the global deep model registry instance.
    Useful for dependency injection or retrieving the
    registry in other modules.
    """
    return deep_registry


def get_csv_manager() -> FileManager:
    """
    Provides a global file manager instance for handling csv storage
    """
    return csv_manager
