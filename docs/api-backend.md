# Phase M0.9: API Backend

## Overview
The NWIS M0.9 API Backend is a thin, read-only FastAPI adapter layer serving the previously generated analytical and historical outputs from M0.4–M0.8.

It is explicitly designed **NOT** to recalculate logic, create new features, or alter anomaly scores. Its sole responsibility is to serve exact data representations chronologically, facilitating deterministic timeline replays for the M1.0 Dashboard.

## Startup Command
```bash
python -m uvicorn backend.app:app --reload
```
Once started, the OpenAPI documentation is accessible at:
- `http://127.0.0.1:8000/docs`

## Data Provenance and Boundaries
- **No Hallucination:** The API strictly propagates the `data_origin` and `verification_status` fields.
- **Null Safety:** Missing components (e.g. absent models, unverified depths, zero historical events) are surfaced as empty arrays, `null`, or boolean unavailability flags. The API never casts `null` to `0` or fabricates a `NORMAL` event out of a missing record.
- **Isolated Prototype:** The `SYNTHETIC_DEMO` Random Forest predictions are exposed but strictly firewalled (`used_in_risk_score: false`) to ensure they do not conflate the current well's actual analytical risk.
- **Chronological Guarantee:** Retrieving data at timestamp `t` uses an exact bisect match to find the latest valid record at or prior to `t`. Future context is strictly excluded from `snapshot` responses to prevent time-travel leakage in replay scenarios.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/health` | API/service health. |
| `/api/v1/wells` | Available wells. |
| `/api/v1/wells/{well_id}/summary` | Pipeline/data availability summary. |
| `/api/v1/wells/{well_id}/risk/current` | Latest risk snapshot. |
| `/api/v1/wells/{well_id}/risk?timestamp=t` | Historical replay snapshot at/before `t`. |
| `/api/v1/wells/{well_id}/risk/timeline` | Chronological risk series. |
| `/api/v1/wells/{well_id}/telemetry` | Existing canonical telemetry records. |
| `/api/v1/wells/{well_id}/intelligence` | M0.5 records. |
| `/api/v1/wells/{well_id}/models` | M0.6 model evidence. |
| `/api/v1/wells/{well_id}/historical-events` | M0.7 historical event records. |
| `/api/v1/wells/{well_id}/historical-context` | M0.7 context applicable to timestamp. |
| `/api/v1/wells/{well_id}/snapshot` | Combined frontend snapshot assembled from existing records. |
