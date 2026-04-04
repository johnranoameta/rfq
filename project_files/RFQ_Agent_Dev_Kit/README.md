# RFQ Agent Dev Kit

This package adds three runnable assets on top of the RFQ test pack:

1. `postman/` – Postman collection + local environment
2. `pytest_suite/` – regression tests aligned to oracle JSON files
3. `mock_server/` – FastAPI mock server for local development

## Suggested workflow
1. Start the mock server from `mock_server/`
2. Hit the endpoints with the Postman collection
3. Run the pytest suite to verify outputs stay aligned with the expected oracle responses

## Quick commands
### Start server
```bash
cd mock_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### Run tests
```bash
cd pytest_suite
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```
