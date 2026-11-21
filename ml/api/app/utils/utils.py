
from typing import List
from pandas import DataFrame


def generate_model_input(
        features: List[str], feature_values: List[float]
        ) -> DataFrame:

    if len(features) != len(feature_values):
        raise ValueError(
            "Number of features must equal the number of feature_values"
            )

    return DataFrame({f: [v] for f, v in zip(features, feature_values)})


def cut_movenet_frames(
    movenet_df: DataFrame,
    frame_cutter_df: DataFrame
) -> DataFrame:
    preds = frame_cutter_df[["frame_ref", "pred"]].rename(
        columns={"frame_ref": "frame_index", "pred": "include_row"}
    )

    movenet_with_preds = movenet_df.merge(preds, on="frame_index", how="left")

    movenet_cut = movenet_with_preds[
        movenet_with_preds["include_row"] == 1
    ].copy()

    movenet_cut = movenet_cut.drop(columns=["include_row"])

    return movenet_cut
