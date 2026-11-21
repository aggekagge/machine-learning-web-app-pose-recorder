from app.core.model_registry import Registry
from app.core.deep_model_registry import DeepModelRegistry
from app.core.model_loader import load_model, load_model_features

"""
Global registry instancse for managing machine learning models.
Uses ModelLoader static methods to load models and their feature names.
"""
registry = Registry(
    model_loader=load_model,
    feature_loader=load_model_features
)

deep_registry = DeepModelRegistry(
    model_loader=load_model
)
