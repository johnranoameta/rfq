
from conftest import load_json


def test_health(client):
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json() == {'status': 'ok'}


def test_parse_case_a_matches_oracle(client):
    req = load_json('parser_request_case_A.json')
    expected = load_json('parser_response_case_A_expected.json')
    r = client.post('/parse', json=req)
    assert r.status_code == 200
    assert r.json() == expected


def test_parse_case_b_matches_oracle(client):
    req = load_json('parser_request_case_B.json')
    expected = load_json('parser_response_case_B_expected.json')
    r = client.post('/parse', json=req)
    assert r.status_code == 200
    assert r.json() == expected


def test_parse_case_c_matches_oracle(client):
    req = load_json('parser_request_case_C.json')
    expected = load_json('parser_response_case_C_expected.json')
    r = client.post('/parse', json=req)
    assert r.status_code == 200
    assert r.json() == expected
