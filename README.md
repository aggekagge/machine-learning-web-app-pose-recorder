# ML Project – 4DT907

This repository contains our machine learning system developed in the course **4DT907**. The system provides predictions through a web interface backed by ML infrastructure using Docker, FastAPI, and MLflow.

**Maintained by:**

- Agust Eliasson (ae224pp)  
- Petter Gustafsson (pg222jw)  
- Kim Wong (kw222qs)  
- Elliot Ehn (ee223zs)  

Our web application is available at:   
https://cu2170.camp.lnu.se

---

# System Overview

Our ML system consists of three main components that work together to deliver predictions:

```bash
+-------------------+
|                   |
|   Web Application |
|  (Frontend +      |
|   Backend)        |
|                   |
+---------+---------+
          |
          | HTTP Request (features)
          | POST /predict
          v
+---------+---------+
|                   |
|   FastAPI Server  |
|   (ML Inference   |
|    Service)       |
|                   |
+---------+---------+
          |
          | Load model from registry
          | (MLflow Python API)
          v
+---------+---------+
|                   |
|   MLflow Server   |
|   Model Registry  |
|                   |
+---------+---------+
```

---

# Components

## 1. Web Application (`sw/`)

Provides the user interface and handles communication with the ML inference service.

**Responsibilities:**

- Accept user input through a web interface  
- Send prediction requests to the FastAPI server  
- Display prediction results  

**Structure:**

- `sw/frontend/` – HTML, CSS, JavaScript frontend  
- `sw/backend/` – Node.js backend server  

---

## 2. FastAPI Server (`ml/api/`)

Acts as the ML inference service and connects the web application to the machine learning models.

**Responsibilities:**

- Provide REST API endpoints such as:
  - `/predict`
  - `/health`
  - `/features`
- Validate incoming requests
- Load models from MLflow or local storage to memory
- Perform inference
- Return prediction results

**Key modules:**

- `main.py` – FastAPI application entry point  
- `routers/` – API route definitions  
- `services/inference.py` – Inference logic  
- `core/model_loader.py` – Loads models
- `core/model_registry.py` – Handles model registry logic

---

## 3. MLflow Service

MLflow is used as the central system for managing, storing, and serving machine learning models in this project. It ensures that models can be versioned, tracked, and reliably accessed by the FastAPI inference server.

**Responsibilities**:

- Version control of models
- Centralized storage
- Enable easier deployment of production models
- Reproducibility of experiments
- Separation between model training and model serving



---

**Note:** Access to the MLflow server requires connection to the university network or VPN.

## Training and registering models

In this project, we use the MLflow Python API to log, register, and manage trained models directly from our training notebooks in the `ml/models/research/` folder. This allows models to be stored on the remote MLflow server and made available for inference by the FastAPI service.

The MLflow API enables programmatic interaction with the MLflow tracking server and model registry.

---

## Logging Models

After training a model in a notebook, we log it to MLflow using the MLflow Python library. This typically includes:

- The trained model artifact
- Model parameters
- Performance metrics
- Additional metadata

Example workflow:

```python
import mlflow
import mlflow.sklearn

mlflow.set_tracking_uri("http://<mlflow-server>:5000")
mlflow.set_experiment("weakest_link_classification")

with mlflow.start_run():

    # Train model
    model.fit(X_train, y_train)

    # Log parameters
    mlflow.log_param("model_type", "RandomForest")
    mlflow.log_param("n_estimators", 100)

    # Log metrics
    mlflow.log_metric("accuracy", accuracy)

    # Log the model artifact
    mlflow.sklearn.log_model(
        model,
        artifact_path="model"
    )
```

# Running the Project with Docker

The entire system is containerized using Docker and orchestrated with Docker Compose.  
This allows you to start all services (web application and FastAPI server) with a few simple commands.

---

## Prerequisites

Make sure you have the following installed:

- Docker
- Docker Compose (included in modern Docker installations)

You can verify your installation with:
```bash
docker --version
docker compose version
```


---

## Build the Containers

Before starting the system for the first time (or after making changes to Dockerfiles), build the images from project root:

```bash
docker compose build
```


This command:

- Builds the web application
- Builds the FastAPI ML service container

---

## Starting and stopping the Application

To start all services in detached moderun:
```bash
docker compose up -d
```

To check that all services are running:
```bash
docker ps
```

You should see multiple containers listed similarly as below: 
```bash
CONTAINER ID   IMAGE                                        COMMAND                  CREATED          STATUS          PORTS                                         NAMES
e0b98ca093e5   machine_learning_project_4dt907-sw-backend   "docker-entrypoint.s…"   13 seconds ago   Up 13 seconds   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp   sw-backend
1b81ed350142   machine_learning_project_4dt907-ml-api       "uvicorn main:app --…"   13 seconds ago   Up 13 seconds   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp   ml-api
```
To stop the application, run:
```bash
docker compose down
```
---


