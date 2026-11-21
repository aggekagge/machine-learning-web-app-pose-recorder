from typing import Dict
from pathlib import Path
from app.core.model import Model
from typing import Any, Callable


class DeepModelRegistry:
    def __init__(self,
                 model_loader: Callable[[Path], Any]
                 ):
        self._models: Dict[str, Model] = {}
        self._model_loader = model_loader

    def register_model(self, model_registry_name: str):
        model = self._model_loader(model_registry_name)
        self._models[model_registry_name] = model

    def remove_model(self, name: str):
        if name in self._models:
            self._models.pop(name)

    def get_model(self, name: str) -> Model:
        if name not in self._models:
            raise KeyError(f"Model '{name}' is not registered.")
        return self._models[name]
