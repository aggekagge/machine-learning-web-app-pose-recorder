# Purpose

The purpose of this document is to provide guidelines for machine learning researchers on what information should be logged in MLflow during experiments.

---

## Parameters

Parameters refer to the configurable inputs that define how a model is trained.

Typical parameters to log include:

- **Model hyperparameters**
  - Learning rate
  - Batch size
  - Number of epochs
  - Optimizer type (e.g., Adam, SGD)
  - Regularization parameters (e.g., weight decay, dropout rate)

- **Model architecture details**
  - Number of layers
  - Activation functions
  - Hidden units per layer

- **Data-related parameters**
  - Dataset version or identifier
  - Train/validation/test split ratios
  - Preprocessing steps (e.g., normalization, augmentation)

- **Training configuration**
  - Random seed
  - Hardware used (CPU/GPU type)
  - Framework versions (e.g., PyTorch, TensorFlow)

---

## Metrics

Metrics are quantitative measures used to evaluate model performance.

Typical metrics to log include:

- **Training metrics**
  - Training loss (per epoch/step)
  - Training accuracy

- **Validation metrics**
  - Validation loss
  - Validation accuracy
  - Precision, recall, F1-score

- **Test metrics**
  - Final test accuracy
  - Confusion matrix
  - ROC-AUC (for classification tasks)

- **Custom metrics (if applicable)**
  - Domain-specific evaluation metrics
  - Latency or inference time
  - Resource usage (e.g., memory, compute time)

- **Tracking over time**
  - Log metrics per epoch or iteration to visualize learning curves

### Naming conventions of metrics

The following metric names are defined to ensure that logged metrics are consistent throughout different experiments:

#### Test metrics

These metrics represent the final evaluation of a trained model on a **hold-out test dataset** that was not used during training or validation. They provide an unbiased estimate of how the model is expected to perform in real-world scenarios.

- Used for **final model comparison and reporting**
- Should only be computed after all model tuning is complete
- The test dataset must remain **untouched during training and cross-validation**

##### Classification
- test_accuracy
- test_precision_weighted
- test_precision_macro
- test_recall_weighted
- test_recall_macro
- test_f1_weighted
- test_f1_macro

##### Regression
- test_mse
- test_rmse
- test_mae
- test_r2

---

#### Cross-validation metrics

These metrics are computed using **k-fold cross-validation** on the training dataset. They summarize model performance across multiple splits, providing a more robust estimate than a single train/validation split.

- Logged as **aggregated statistics across folds**
- Include both **mean** (average performance) and **std** (stability/variance)


##### Classification
- accuracy_mean
- accuracy_std
- precision_weighted_mean
- precision_weighted_std
- precision_macro_mean
- precision_macro_std
- recall_weighted_mean
- recall_weighted_std
- recall_macro_mean
- recall_macro_std
- f1_weighted_mean
- f1_weighted_std
- f1_macro_mean
- f1_macro_std

##### Regression
- mse_mean
- mse_std
- rmse_mean
- rmse_std
- mae_mean
- mae_std
- r2_mean
- r2_std

---

## Additional Recommendations
- Use consistent naming conventions for parameters and metrics.
- Keep logs structured to simplify comparison and analysis.