from pydantic_settings import BaseSettings
from pathlib import Path

"""
TODO:
* Hopefully remove all path related code since we will be communiating
with MLflow instead.
* If the paths are necessary, then insert them in a new class.
"""


class Settings(BaseSettings):
    # base folder
    model_path: str = "../trained_models"

    # model folders
    weakest_link: str = "weakest_link_model"
    score: str = "score_model"

    # Exception name for now. Needs to be removed.
    model_score_name: str = "champion_model.pkl"

    # new standard model names
    model_name: str = "champion_model.joblib"
    model_meta: str = "champion_meta.json"

    def get_score_model_path(self) -> Path:
        return Path(self.model_path) / self.score / self.model_score_name

    def get_score_meta(self) -> Path:
        return Path(self.model_path) / self.score / self.model_meta

    def get_weakest_link_path(self) -> Path:
        return Path(self.model_path) / self.weakest_link / self.model_name

    def get_weakest_link_meta(self) -> Path:
        return Path(self.model_path) / self.weakest_link / self.model_meta
