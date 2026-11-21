from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    RandomForestClassifier,
    RandomForestRegressor,
    StackingClassifier,
    StackingRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


RANDOM_SEED = 42
TEST_SIZE = 0.1


def get_ml_root() -> Path:
    # .../ml/models/research/A5/stacking_train_and_predict.py -> ml
    return Path(__file__).resolve().parents[3]


ML_ROOT = get_ml_root()
PROCESSED_DIR = ML_ROOT / "models" / "data" / "processed"
TRAINED_MODELS_DIR = ML_ROOT / "trained_models"
# Reuse A4 split ids so comparisons stay aligned with earlier project stages.
SPLIT_IDS_PATH = ML_ROOT / "models" / "research" / "A4" / "split_ids.pkl"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_split_ids(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    with open(path, "rb") as f:
        obj = pickle.load(f)
    return obj if isinstance(obj, dict) else None


def ensure_interactions(df: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    # Rebuild interaction features only when champion metadata expects them.
    out = df.copy()
    for col in feature_cols:
        if col in out.columns:
            continue
        if "_x_" not in col:
            continue
        left, right = col.split("_x_", 1)
        if left in out.columns and right in out.columns:
            out[col] = pd.to_numeric(out[left], errors="coerce") * pd.to_numeric(
                out[right], errors="coerce"
            )
    return out


def load_regression_data(feature_cols: list[str]) -> tuple[pd.DataFrame, pd.Series, pd.Series | None]:
    df = pd.read_csv(PROCESSED_DIR / "AimoScore_WeakLink_big_scores.csv")
    df = ensure_interactions(df, feature_cols)

    x = df[feature_cols].apply(pd.to_numeric, errors="coerce")
    y = pd.to_numeric(df["AimoScore"], errors="coerce")
    valid = y.notna()
    ids = df.loc[valid, "ID"] if "ID" in df.columns else None
    return x.loc[valid], y.loc[valid], ids


def load_classification_data(
    feature_cols: list[str],
) -> tuple[pd.DataFrame, pd.Series, pd.Series | None]:
    scores = pd.read_csv(PROCESSED_DIR / "20190108_scores_and_weak_links.csv")
    big = pd.read_csv(PROCESSED_DIR / "AimoScore_WeakLink_big_scores.csv")

    non_indicators = {"ID", "Date", "SCORE"}
    indicator_cols = [c for c in scores.columns if c not in non_indicators]
    scores[indicator_cols] = scores[indicator_cols].apply(pd.to_numeric, errors="coerce")
    scores["WeakestLink"] = scores[indicator_cols].idxmax(axis=1)

    labels = scores[["ID", "WeakestLink"]].dropna()
    data = big.merge(labels, on="ID", how="inner")

    x = data[feature_cols].apply(pd.to_numeric, errors="coerce")
    y = data["WeakestLink"].astype(str)

    # Minimal safety so split/CV do not fail on singleton classes.
    counts = y.value_counts()
    keep = set(counts[counts >= 2].index.tolist())
    keep_mask = y.isin(keep)
    return x.loc[keep_mask], y.loc[keep_mask], data.loc[keep_mask, "ID"]


def split_using_ids(
    x: pd.DataFrame,
    y: pd.Series,
    ids: pd.Series | None,
    split_ids: dict[str, Any] | None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, str] | None:
    # Optional: honor fixed train/test IDs from A4 for reproducible team comparisons.
    if ids is None or split_ids is None:
        return None
    train_ids = set(split_ids.get("train_ids", []))
    test_ids = set(split_ids.get("test_ids", []))
    if not train_ids or not test_ids:
        return None

    train_mask = ids.isin(train_ids)
    test_mask = ids.isin(test_ids)
    if train_mask.sum() == 0 or test_mask.sum() == 0:
        return None

    return (
        x.loc[train_mask],
        x.loc[test_mask],
        y.loc[train_mask],
        y.loc[test_mask],
        "A4 split_ids.pkl",
    )


def regression_metrics(model: Any, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float]:
    pred = model.predict(x_test)
    return {
        "test_r2": float(r2_score(y_test, pred)),
        "test_rmse": float(np.sqrt(mean_squared_error(y_test, pred))),
        "test_mae": float(mean_absolute_error(y_test, pred)),
    }


def classification_metrics(model: Any, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float]:
    pred = model.predict(x_test)
    return {
        "test_accuracy": float(accuracy_score(y_test, pred)),
        "test_precision_macro": float(
            precision_score(y_test, pred, average="macro", zero_division=0)
        ),
        "test_recall_macro": float(
            recall_score(y_test, pred, average="macro", zero_division=0)
        ),
        "test_f1_macro": float(f1_score(y_test, pred, average="macro", zero_division=0)),
        "test_f1_weighted": float(
            f1_score(y_test, pred, average="weighted", zero_division=0)
        ),
    }


def train_regression_stack(
    output_dir: Path,
    split_ids: dict[str, Any] | None,
) -> dict[str, Any]:
    # Keep feature contract synced with active regression champion metadata.
    feature_cols = load_json(TRAINED_MODELS_DIR / "score_model" / "champion_meta.json")["feature_cols"]
    x, y, ids = load_regression_data(feature_cols)

    split = split_using_ids(x, y, ids, split_ids)
    if split is None:
        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
        )
        split_protocol = f"train_test_split(random_state={RANDOM_SEED}, test_size={TEST_SIZE})"
    else:
        x_train, x_test, y_train, y_test, split_protocol = split

    estimators = [
        (
            "lr",
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("model", LinearRegression()),
                ]
            ),
        ),
        (
            "ridge",
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                    ("model", Ridge(alpha=1.0, random_state=RANDOM_SEED)),
                ]
            ),
        ),
        (
            "rf",
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    (
                        "model",
                        RandomForestRegressor(
                            n_estimators=300,
                            random_state=RANDOM_SEED,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        ),
    ]

    model = StackingRegressor(
        estimators=estimators,
        final_estimator=Ridge(alpha=1.0, random_state=RANDOM_SEED),
        cv=5,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)
    metrics = regression_metrics(model, x_test, y_test)

    # Write isolated A5 artifacts so earlier champions are untouched.
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_dir / "champion_model.pkl")
    joblib.dump(feature_cols, output_dir / "champion_feature_names.pkl")
    save_json(
        output_dir / "champion_meta.json",
        {
            "model_name": "stacking_regressor_sklearn",
            "feature_cols": feature_cols,
            "cv_splits": 5,
            "split_protocol": split_protocol,
        },
    )
    with open(output_dir / "champion_metrics.pkl", "wb") as f:
        pickle.dump({"name": "StackingRegressor", **metrics}, f)

    sample_prediction = float(model.predict(x_test.iloc[[0]])[0]) if len(x_test) else None
    return {
        "artifacts_dir": str(output_dir),
        "metrics": metrics,
        "sample_prediction": sample_prediction,
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
        "split_protocol": split_protocol,
    }


def train_classification_stack(
    output_dir: Path,
    split_ids: dict[str, Any] | None,
) -> dict[str, Any]:
    # Keep feature contract synced with active classification champion metadata.
    feature_cols = load_json(TRAINED_MODELS_DIR / "weakest_link_model" / "champion_meta.json")[
        "feature_cols"
    ]
    x, y, ids = load_classification_data(feature_cols)

    split = split_using_ids(x, y, ids, split_ids)
    if split is None:
        x_train, x_test, y_train, y_test = train_test_split(
            x,
            y,
            test_size=TEST_SIZE,
            random_state=RANDOM_SEED,
            stratify=y,
        )
        split_protocol = (
            f"train_test_split(stratify=True, random_state={RANDOM_SEED}, test_size={TEST_SIZE})"
        )
    else:
        x_train, x_test, y_train, y_test, split_protocol = split

    cv_splits = max(2, min(5, int(y_train.value_counts().min())))
    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=RANDOM_SEED)

    estimators = [
        (
            "logreg",
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                    (
                        "model",
                        LogisticRegression(
                            max_iter=5000,
                            class_weight="balanced",
                            random_state=RANDOM_SEED,
                        ),
                    ),
                ]
            ),
        ),
        (
            "rf",
            Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    (
                        "model",
                        RandomForestClassifier(
                            n_estimators=300,
                            class_weight="balanced_subsample",
                            random_state=RANDOM_SEED,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        ),
    ]

    model = StackingClassifier(
        estimators=estimators,
        final_estimator=LogisticRegression(
            max_iter=5000,
            class_weight="balanced",
            random_state=RANDOM_SEED,
        ),
        cv=cv,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)
    metrics = classification_metrics(model, x_test, y_test)

    # Write isolated A5 artifacts so teammates can integrate later.
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_dir / "champion_model.joblib")
    save_json(
        output_dir / "champion_meta.json",
        {
            "feature_cols": feature_cols,
            "model_name": "stacking_classifier_sklearn",
            "classes": sorted(pd.Series(model.classes_).astype(str).tolist()),
            "cv_splits": cv_splits,
            "split_protocol": split_protocol,
            "uses_label_encoder": False,
        },
    )
    with open(output_dir / "champion_metrics.pkl", "wb") as f:
        pickle.dump({"name": "StackingClassifier", **metrics}, f)

    sample_prediction = str(model.predict(x_test.iloc[[0]])[0]) if len(x_test) else None
    return {
        "artifacts_dir": str(output_dir),
        "metrics": metrics,
        "sample_prediction": sample_prediction,
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
        "cv_splits": cv_splits,
        "split_protocol": split_protocol,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simple stacking training + sample stack prediction for regression/classification."
    )
    parser.add_argument(
        "--mode",
        choices=["both", "regression", "classification"],
        default="both",
    )
    parser.add_argument(
        "--output-root",
        type=str,
        default=str(TRAINED_MODELS_DIR / "A5" / "stacking"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    split_ids = load_split_ids(SPLIT_IDS_PATH)
    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    summary: dict[str, Any] = {"output_root": str(output_root), "mode": args.mode}

    if args.mode in {"both", "regression"}:
        print("[stacking] training regression stack...")
        reg_summary = train_regression_stack(output_root / "score_model", split_ids)
        print("[stacking] regression metrics:", reg_summary["metrics"])
        summary["regression"] = reg_summary

    if args.mode in {"both", "classification"}:
        print("[stacking] training classification stack...")
        cls_summary = train_classification_stack(output_root / "weakest_link_model", split_ids)
        print("[stacking] classification metrics:", cls_summary["metrics"])
        summary["classification"] = cls_summary

    summary_path = output_root / "stacking_summary.json"
    save_json(summary_path, summary)
    print(f"[stacking] summary saved to: {summary_path}")
    print(json.dumps(summary, indent=2))

main()
