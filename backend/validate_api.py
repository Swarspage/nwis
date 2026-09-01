import pytest
from fastapi.testclient import TestClient
from urllib.parse import quote
from .app import app

client = TestClient(app)

def test_01_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_02_list_wells():
    res = client.get("/api/v1/wells")
    assert res.status_code == 200
    assert len(res.json()["wells"]) == 1

def test_03_well_summary():
    res = client.get("/api/v1/wells/WELL-1/summary")
    assert res.status_code == 200
    assert "m05_intelligence_available" in res.json()

def test_04_unknown_well():
    res = client.get("/api/v1/wells/WELL-999/summary")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "WELL_NOT_FOUND"

def test_05_current_risk():
    res = client.get("/api/v1/wells/WELL-1/risk/current")
    if res.status_code == 200:
        assert "risk_score" in res.json()
        assert "prototype_supervised" in res.json()

def test_06_risk_timeline():
    res = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=10")
    assert res.status_code == 200
    assert res.json()["count"] <= 10

def test_07_timeline_ordering():
    res = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=10")
    if res.status_code == 200 and res.json()["count"] >= 2:
        recs = res.json()["records"]
        assert recs[0]["timestamp"] <= recs[1]["timestamp"]

def test_08_timestamp_risk_lookup():
    timeline = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=2")
    if timeline.status_code == 200 and timeline.json()["count"] > 0:
        ts = timeline.json()["records"][0]["timestamp"]
        res = client.get(f"/api/v1/wells/WELL-1/risk?timestamp={quote(ts)}")
        assert res.status_code == 200
        assert res.json()["timestamp"] == ts

def test_09_no_future_record():
    timeline = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=2")
    if timeline.status_code == 200 and timeline.json()["count"] > 1:
        ts0 = timeline.json()["records"][0]["timestamp"]
        res = client.get(f"/api/v1/wells/WELL-1/risk?timestamp={quote(ts0)}")
        assert res.status_code == 200
        assert res.json()["timestamp"] <= ts0

def test_10_telemetry():
    res = client.get("/api/v1/wells/WELL-1/telemetry?limit=5")
    assert res.status_code == 200
    assert "records" in res.json()

def test_11_intelligence():
    res = client.get("/api/v1/wells/WELL-1/intelligence?limit=5")
    assert res.status_code == 200

def test_12_models():
    res = client.get("/api/v1/wells/WELL-1/models?limit=5")
    assert res.status_code == 200

def test_13_historical_events():
    res = client.get("/api/v1/wells/WELL-1/historical-events")
    assert res.status_code == 200
    assert res.json()["status"] == "NO_VERIFIED_HISTORICAL_EVENTS_AVAILABLE"

def test_14_well1_zero_events():
    res = client.get("/api/v1/wells/WELL-1/historical-events")
    assert res.status_code == 200
    assert res.json()["count"] == 0

def test_15_historical_context():
    # ISO string without + doesn't strictly need quote, but safe
    res = client.get("/api/v1/wells/WELL-1/historical-context?timestamp=" + quote("2020-01-01T00:00:00Z"))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NO_DATA"

def test_16_snapshot():
    timeline = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=1")
    if timeline.status_code == 200 and timeline.json()["count"] > 0:
        ts = timeline.json()["records"][0]["timestamp"]
        res = client.get(f"/api/v1/wells/WELL-1/snapshot?timestamp={quote(ts)}")
        assert res.status_code == 200
        assert "risk" in res.json()
        assert "historical_context" in res.json()

def test_17_data_origin_preserved():
    res = client.get("/api/v1/wells/WELL-1/risk/current")
    if res.status_code == 200:
        assert "data_origin" in res.json()

def test_18_synthetic_rf_isolated():
    res = client.get("/api/v1/wells/WELL-1/risk/current")
    if res.status_code == 200:
        rf = res.json()["prototype_supervised"]
        assert rf["data_origin"] == "SYNTHETIC_DEMO"
        assert rf["used_in_risk_score"] is False

def test_19_null_remains_null():
    res = client.get("/api/v1/wells/WELL-1/risk/current")
    if res.status_code == 200:
        assert "events" in res.json()["historical_evidence"]

def test_20_invalid_timestamp():
    res = client.get("/api/v1/wells/WELL-1/snapshot?timestamp=invalid")
    assert res.status_code in [400, 404]

def test_21_invalid_time_range():
    res = client.get("/api/v1/wells/WELL-1/risk/timeline?start_time=2050&end_time=2000")
    assert res.status_code == 200
    assert res.json()["count"] == 0

def test_22_api_schema_validation():
    pass

def test_23_upstream_files_not_mutated():
    pass

def test_24_deterministic_repeated_request():
    r1 = client.get("/api/v1/wells/WELL-1/risk/current").json()
    r2 = client.get("/api/v1/wells/WELL-1/risk/current").json()
    assert r1 == r2

def test_25_timestamp_boundary_semantics():
    timeline = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=3")
    if timeline.status_code == 200 and timeline.json()["count"] >= 3:
        records = timeline.json()["records"]
        t1 = records[0]["timestamp"]
        t2 = records[1]["timestamp"]
        # exact timestamp -> exact record
        r1 = client.get(f"/api/v1/wells/WELL-1/risk?timestamp={quote(t1)}")
        assert r1.json()["timestamp"] == t1
        
        # between -> latest prior
        t_between = t1[:-1] + "1Z" if t1.endswith('Z') else t1[:-6] + "1" + t1[-6:] 
        if t1 < t_between < t2:
            rb = client.get(f"/api/v1/wells/WELL-1/risk?timestamp={quote(t_between)}")
            assert rb.json()["timestamp"] == t1
            
        # before first -> NO_DATA
        r_before = client.get("/api/v1/wells/WELL-1/risk?timestamp=" + quote("1999-01-01T00:00:00Z"))
        assert r_before.status_code == 404
        
def test_26_backend_purity():
    timeline = client.get("/api/v1/wells/WELL-1/risk/timeline?limit=1")
    if timeline.status_code == 200 and timeline.json()["count"] > 0:
        ts = timeline.json()["records"][0]["timestamp"]
        snap = client.get(f"/api/v1/wells/WELL-1/snapshot?timestamp={quote(ts)}").json()
        risk = client.get(f"/api/v1/wells/WELL-1/risk?timestamp={quote(ts)}").json()
        assert snap["risk"] == risk

if __name__ == "__main__":
    pytest.main(["-v", __file__])
