from random import choice
from pandas import DataFrame

"""
Dummy models used as temporary placeholders in the system.

These models allow the software team to develop and test
the application before real machine learning models are available.
They provide predictable or random outputs that
mimic the interface of real models.
"""


class DummyScoreModel:
    version = "dummy-score-1.0"

    def predict(self, feature_values: DataFrame):
        row = feature_values.iloc[0]
        return [row.sum() * 0.5]


class DummyWeakestLinkModel:
    version = "dummy-weakest-link-1.0"

    def predict(self, X: DataFrame):
        return [choice(["head", "shoulder", "back", "waist", "hip", "knee",
                       "ankle"])]
