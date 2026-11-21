# Machine Learning Research Project

## Overview

This repository contains materials for a machine learning research
project focused on experimenting with different modeling strategies,
data processing pipelines, and evaluation approaches. The project is
organized to separate raw and processed data from experimental research
work.

The repository primarily serves as a workspace for iterative
experimentation, model development, and evaluation within a
research-oriented workflow.

## Project Structure

### data/

Contains datasets used in the project.

-   **raw/** -- Original source datasets as they were collected or
    received.
-   **processed/** -- Cleaned or transformed datasets prepared for
    machine learning experiments.

### research/

This directory contains research and experimentation work.\
Different subfolders represent separate research phases, experiments, or
iterations of the project. The work in this directory focuses on
exploring modeling approaches, testing ideas, and evaluating results.

### requirements.txt

Lists the Python dependencies required to reproduce the research
environment and run the experiments.



## Usage

1. Initialize a venv project by executing `python -m -m venv <NAME_OF_VENV_FOLDER>`
2. Enter the environment: `source <NAME_OF_VENV_FOLDER>bin/activate` (or `./<NAME_OF_VENV_FOLDER>\Scripts\activate` for windows)
1.  Install the required dependencies using `pip install requirements.txt`.
2.  Use the datasets in the `data/` directory for experiments.
3.  Conduct research and modeling experiments within the `research/`
    directory.

## Notes

This repository is intended for research and experimentation purposes.
The structure supports incremental experimentation and the comparison of
different machine learning approaches.


## MLflow Usage

This project uses **MLflow** for experiment tracking, model logging, and reproducibility.  
All experiments should be logged to MLflow to ensure that results, parameters, and models can be traced and reproduced.

### Logging Requirements

When logging experiments and models, the following information **must always be included**:

- **Experiment name**  
  Each experiment should be logged under a clearly named MLflow experiment.

- **Parameters**  
  All relevant model and training parameters must be logged (e.g. hyperparameters, dataset version, preprocessing choices).

- **Models with input features**  
  Logged models must include the **input features used to generate predictions** so that the model can be reproduced and used correctly later.

- **Descriptions**  
  Both experiments and models should include a **clear description** explaining:
  - the purpose of the experiment
  - what was tested
  - key assumptions or configurations

This ensures reproducibility, transparency, and easier comparison between experiments.

---

### Example: Logging an Experiment with MLflow

```python
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier

# Example parameters
params = {
    "n_estimators": 100,
    "max_depth": 10,
    "random_state": 42
}

input_features = [
    "feature_1",
    "feature_2",
    "feature_3"
]

mlflow.set_experiment("weakest_link_classification")

with mlflow.start_run(run_name="random_forest_baseline"):

    # Log parameters
    mlflow.log_params(params)

    # Train model
    model = RandomForestClassifier(**params)
    model.fit(X_train, y_train)

    # Log metrics
    mlflow.log_metric("accuracy", accuracy)

    # Log model
    mlflow.sklearn.log_model(
        model,
        artifact_path="model",
        input_example=X_train[input_features].head(5)
    )

    # Add metadata / description
    mlflow.set_tag("description", "Baseline RandomForest model for weakest link classification.")
    mlflow.set_tag("input_features", ", ".join(input_features))
```

### Best Practices

- Use **clear experiment names** reflecting the task or model family.
- Log **all relevant hyperparameters** for reproducibility.
- Store **input feature lists** together with the model.
- Include **descriptions and tags** to explain the purpose of each run.
- Keep experiments organized so that results from different research phases can be easily compared.