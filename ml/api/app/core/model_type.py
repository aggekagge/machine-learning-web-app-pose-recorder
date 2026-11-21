from enum import Enum


class ModelType(Enum):
    """
    Enumeration of supported model types in the system.
    """
    SCORE = "score_model"
    WEAKEST_LINK = "weakest_link_model"
    FRAME_CUTTER = "frame_cutter"
    MOVENET_TO_2D_KINECT = "movenet_to_2d_kinect"
    TWOD_KINECT_TO_3D_KINECT = "2d_kinect_to_3d_kinect"
    GOOD_BAD_EXERCISE = "good_bad_exercise"
    RECORD_QUALITY = "record_quality"
    DEEP_SCORE_MODEL = "deep_score_model"
