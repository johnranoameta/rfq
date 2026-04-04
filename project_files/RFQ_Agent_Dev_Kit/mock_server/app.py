
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent / 'rfq_test_pack' / 'api_samples'

CASE_MAP = {
    'case_A': {
        'parser_expected': 'parser_response_case_A_expected.json',
        'gap_expected': None,
    },
    'case_B': {
        'parser_expected': 'parser_response_case_B_expected.json',
        'gap_expected': 'gap_response_case_B_expected.json',
    },
    'case_C': {
        'parser_expected': 'parser_response_case_C_expected.json',
        'gap_expected': 'gap_response_case_C_expected.json',
    },
}

class ParseRequest(BaseModel):
    case_id: str | None = None
    rfq_package_path: str | None = None
    historical_dataset: str | None = None
    mode: str | None = None

class GapReviewRequest(BaseModel):
    current_rfq: Dict[str, Any]
    historical_dataset: str | None = None
    enabled_rules: str | list[str] | None = 'all'

app = FastAPI(title='RFQ Agent Mock Server', version='1.0.0')


def load_json(name: str) -> Dict[str, Any]:
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def infer_case_id(value: str | None) -> str:
    if not value:
        raise HTTPException(status_code=400, detail='case_id missing')
    value = value.strip()
    aliases = {
        'A': 'case_A', 'case_A': 'case_A', 'case-a': 'case_A',
        'B': 'case_B', 'case_B': 'case_B', 'case-b': 'case_B',
        'C': 'case_C', 'case_C': 'case_C', 'case-c': 'case_C',
    }
    if value in aliases:
        return aliases[value]
    raise HTTPException(status_code=404, detail=f'Unknown case_id: {value}')

@app.get('/health')
def health() -> Dict[str, str]:
    return {'status': 'ok'}

@app.get('/cases')
def cases() -> Dict[str, Any]:
    return {'cases': list(CASE_MAP.keys())}

@app.post('/parse')
def parse_rfq(req: ParseRequest) -> Dict[str, Any]:
    case_id = infer_case_id(req.case_id)
    meta = CASE_MAP[case_id]
    return load_json(meta['parser_expected'])

@app.post('/gap-review')
def gap_review(req: GapReviewRequest) -> Dict[str, Any]:
    rfq_case = req.current_rfq.get('rfq_case')
    case_id = infer_case_id(rfq_case)
    meta = CASE_MAP[case_id]
    if not meta['gap_expected']:
        raise HTTPException(status_code=400, detail=f'No gap-review oracle for {case_id}')
    return load_json(meta['gap_expected'])
