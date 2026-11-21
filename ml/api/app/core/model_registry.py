from typing import Dict
from pathlib import Path
from app.core.model import Model
import app.core.dummy_models as dm
from app.core.model_type import ModelType
from typing import Any, Callable


class Registry:
    """
    Manages a collection of machine learning models and their associated
    features. Supports registering models using provided loader
    functions, retrieving registered models by name, and setting up
    dummy models for testing or development purposes.

    Attributes:
        _models: A dictionary mapping model names to Model instances.
        _model_loader: Callable to load a model from a file path.
        _feature_loader: Callable to load feature names from a file path.
    """

    def __init__(self,
                 model_loader: Callable[[Path], Any],
                 feature_loader: Callable[[Path], Any]
                 ):
        self._models: Dict[str, Model] = {}
        self._model_loader = model_loader
        self._feature_loader = feature_loader

    def register_model(self, name: str):
        model_obj = self._model_loader(name)
        features = self._feature_loader(name)
        model = Model(model=model_obj, features=features)
        self._models[name] = model

    def set_dummy_models(self):
        self._models.clear()
        self._models[ModelType.SCORE.value] = Model(
            model=dm.DummyScoreModel(),
            features=["F1", "F2", "F3"]
        )
        self._models[ModelType.WEAKEST_LINK.value] = Model(
            model=dm.DummyWeakestLinkModel(),
            features=["F4", "F5", "F6"]
        )

    def remove_model(self, name: str):
        if name in self._models:
            self._models.pop(name)

    def get_model(self, name: str) -> Model:
        if name not in self._models:
            raise KeyError(f"Model '{name}' is not registered.")
        return self._models[name]
