# RFQ Agent Mock Server

## Start
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Run from the `mock_server` directory.

## Endpoints
- `GET /health`
- `GET /cases`
- `POST /parse`
- `POST /gap-review`
