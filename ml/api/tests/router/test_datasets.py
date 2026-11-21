# tests/test_datasets_router.py
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.dependencies.dependencies import get_csv_manager
from app.routers.datasets import router


class DummyFileManager:
    def __init__(self):
        self.saved_calls = []
        self.files = ["a.csv", "b.csv"]

    def save_file(self, filename, content):
        self.saved_calls.append((filename, content))
        return f"/fake/path/{filename}"

    def list_files(self):
        return self.files


def create_test_app(file_manager):
    app = FastAPI()
    app.include_router(router)

    app.dependency_overrides[get_csv_manager] = lambda: file_manager
    return app


def test_list_files_returns_all_csv_files():
    file_manager = DummyFileManager()
    client = TestClient(create_test_app(file_manager))

    response = client.get("/datasets/list_csv_files")

    assert response.status_code == 200
    assert response.json() == {
        "files": ["a.csv", "b.csv"]
    }


def test_save_csv_saves_file_and_returns_metadata():
    file_manager = DummyFileManager()
    client = TestClient(create_test_app(file_manager))

    response = client.post(
        "/datasets/csv/save",
        files={"file": ("test.csv", b"col1,col2\n1,2\n", "text/csv")}
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "saved",
        "filename": "test.csv",
        "path": "/fake/path/test.csv",
    }

    assert len(file_manager.saved_calls) == 1
    saved_filename, saved_content = file_manager.saved_calls[0]
    assert saved_filename == "test.csv"
    assert saved_content == b"col1,col2\n1,2\n"


def test_save_csv_rejects_non_csv_file():
    file_manager = DummyFileManager()
    client = TestClient(create_test_app(file_manager))

    response = client.post(
        "/datasets/csv/save",
        files={"file": ("test.txt", b"hello", "text/plain")}
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Only CSV files are allowed"
    }
