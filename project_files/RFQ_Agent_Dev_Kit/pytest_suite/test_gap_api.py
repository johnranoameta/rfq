
from conftest import load_json


def test_gap_case_b_matches_oracle(client):
    req = load_json('gap_request_case_B.json')
    expected = load_json('gap_response_case_B_expected.json')
    r = client.post('/gap-review', json=req)
    assert r.status_code == 200
    assert r.json() == expected


def test_gap_case_c_matches_oracle(client):
    req = load_json('gap_request_case_C.json')
    expected = load_json('gap_response_case_C_expected.json')
    r = client.post('/gap-review', json=req)
    assert r.status_code == 200
    assert r.json() == expected


def test_gap_case_a_returns_400(client):
    req = load_json('parser_response_case_A_expected.json')
    wrapped = {'current_rfq': req, 'historical_dataset': './historical_data/Parsed_Historical_RFQs.jsonl', 'enabled_rules': 'all'}
    r = client.post('/gap-review', json=wrapped)
    assert r.status_code == 400
    assert 'No gap-review oracle' in r.json()['detail']
