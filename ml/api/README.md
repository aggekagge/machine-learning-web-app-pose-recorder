# FastAPI Inference Service

## Overview

This project is an inference API built using **FastAPI** in Python. Its purpose is to expose machine learning model functionality through a REST API, allowing clients to:

- Load and manage models
- Perform predictions (inference)
- Inspect available features
- Monitor system health

The architecture is designed with **separation of concerns**, making it easy to add new models, extend functionality, and maintain the system over time.

---

# Running the service

## Requirements
- Conda (Miniconda or Anaconda)
- Python 3.11

## Local Development Setup

Make sure your current working directory is the project root (where `main.py` is located).

### 1. Create a venv environment

```bash
python -m venv venv # environment folder will be named venv here. Can be replaced with any name.
```

### 2. Activate environment
```bash
# Mac / Linux
source venv/bin/activate

# Windows (Command Prompt)
venv\Scripts\activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt # Only needed for testing, linting, etc.
```

### 4. Run the API server

```bash
uvicorn main:app
```

The API will be available at: 

```
http://127.0.0.1:8000
```

Interactive documentation to test API endpoints: 

```
http://127.0.0.1:8000/docs#
```

---

# Running the service with Docker

### 1. Build Docker Image

Open terminal in the project folder and run:

```bash
docker build -t <IMAGE_NAME> .
```

### 2. Run Docker Container

Start the container:

```bash
docker run -d -p 8000:8000 --name <CONTAINER_NAME> <IMAGE_NAME>
```

### 3. Check Running Containers

```bash
docker ps
```

### 4. Stop Container

```bash
docker stop <CONTAINER_NAME>
```

---

# Adding new dependencies

Install the package:

```bash
python -m pip install <package-name>
```

Then manually add it to `requirements.txt` or `requirements-dev.txt` depending on whether the package is needed for production or development.

Example:

```
numpy==1.26.4
```

---

# Testing

To run tests, make sure that you have installed the dependencies in `requirements-dev.txt`, then run:

```bash
pytest
```

---

# Formatting

To maintain a consistent coding style across the project, we use **Flake8**, a Python tool that checks for style guide compliance, syntax errors, and common programming mistakes. Flake8 enforces **PEP 8** standards, helping to keep the code clean and readable.

To check your code, run:

```bash
flake8 .
```
