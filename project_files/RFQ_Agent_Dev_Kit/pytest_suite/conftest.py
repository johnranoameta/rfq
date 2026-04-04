
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'mock_server'))

from app import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

API_SAMPLES = ROOT / 'rfq_test_pack' / 'api_samples'


def load_json(name: str):
    return json.loads((API_SAMPLES / name).read_text(encoding='utf-8'))


import pytest

@pytest.fixture(scope='session')
def client():
    return TestClient(app)
