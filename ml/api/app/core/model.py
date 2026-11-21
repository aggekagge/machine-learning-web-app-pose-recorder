from typing import List


class Model:

    """
    Encapsulates a machine learning model and its associated feature names.
    Attributes:
        _model: The machine learning model instance.
        _features: List of feature names corresponding to the model inputs.
    """

    def __init__(self, model: object, features: List[str]):
        self._model = model
        self._features = features

    def get_model(self) -> object:
        return self._model

    def get_features(self) -> object:
        return self._features
