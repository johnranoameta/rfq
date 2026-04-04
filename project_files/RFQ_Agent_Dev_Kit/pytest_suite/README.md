# pytest regression suite

## Run
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```

The suite validates the mock server responses against the oracle JSON files in `../rfq_test_pack/api_samples`.
