from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .config import config
from .errors import APIError, api_error_handler, WellNotFoundError, NoDataError, InvalidTimestampError
from .data_service import data_service
from .replay_service import build_snapshot, get_historical_context

app = FastAPI(
    title="NWIS M0.9 API Backend",
    description="Frontend-facing API over the M0.4-M0.8 pipeline.",
    version=config.API_VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(APIError, api_error_handler)

def _validate_well(well_id: str):
    if well_id != "WELL-1":
        raise WellNotFoundError()

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "service": "nwis-api",
        "api_version": config.API_VERSION
    }

@app.get("/api/v1/wells")
def list_wells():
    return {
        "wells": [
            {
                "well_id": "WELL-1",
                "source_system": "VLOVE",
                "data_origin": "HISTORICAL_SOURCE"
            }
        ]
    }

@app.get("/api/v1/wells/{well_id}/summary")
def get_well_summary(well_id: str):
    _validate_well(well_id)
    if not data_service.summary:
        raise NoDataError()
    return data_service.summary

@app.get("/api/v1/wells/{well_id}/risk/current")
def get_current_risk(well_id: str):
    _validate_well(well_id)
    if not data_service.risk:
        raise NoDataError()
    return data_service.risk[-1]

import re

def _validate_timestamp(ts: str):
    if not ts:
        raise InvalidTimestampError("Timestamp cannot be empty.")
    # Basic ISO 8601 check (at least starts with YYYY-MM-DD)
    if not re.match(r"^\d{4}-\d{2}-\d{2}", ts):
        raise InvalidTimestampError("Timestamp must be in ISO-8601 format.")

@app.get("/api/v1/wells/{well_id}/risk")
def get_risk_at_timestamp(well_id: str, timestamp: str):
    _validate_well(well_id)
    _validate_timestamp(timestamp)
    rec = data_service.get_latest_before_or_at(data_service.risk, data_service.risk_ts, timestamp)
    if not rec:
        raise NoDataError()
    return rec

@app.get("/api/v1/wells/{well_id}/risk/timeline")
def get_risk_timeline(well_id: str, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    records = data_service.get_timeline(data_service.risk, start_time, end_time, limit)
    return {
        "well_id": well_id,
        "count": len(records),
        "records": records
    }

@app.get("/api/v1/wells/{well_id}/telemetry")
def get_telemetry(well_id: str, timestamp: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    if timestamp:
        rec = data_service.get_latest_before_or_at(data_service.telemetry, data_service.telemetry_ts, timestamp)
        records = [rec] if rec else []
    else:
        records = data_service.get_timeline(data_service.telemetry, start_time, end_time, limit)
        
    return {
        "well_id": well_id,
        "count": len(records),
        "records": records
    }

@app.get("/api/v1/wells/{well_id}/intelligence")
def get_intelligence(well_id: str, timestamp: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    if timestamp:
        rec = data_service.get_latest_before_or_at(data_service.intelligence, data_service.intelligence_ts, timestamp)
        records = [rec] if rec else []
    else:
        records = data_service.get_timeline(data_service.intelligence, start_time, end_time, limit)
        
    return {
        "well_id": well_id,
        "count": len(records),
        "records": records
    }

@app.get("/api/v1/wells/{well_id}/models")
def get_models(well_id: str, timestamp: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    if timestamp:
        records = data_service.get_models_at(timestamp)
    else:
        records = data_service.get_timeline(data_service.models, start_time, end_time, limit)
        
    return {
        "well_id": well_id,
        "count": len(records),
        "records": records
    }

@app.get("/api/v1/wells/{well_id}/historical-events")
def get_historical_events(well_id: str):
    _validate_well(well_id)
    count = len(data_service.historical_events)
    return {
        "well_id": well_id,
        "count": count,
        "events": data_service.historical_events,
        "status": "NO_VERIFIED_HISTORICAL_EVENTS_AVAILABLE" if count == 0 else "OK"
    }

@app.get("/api/v1/wells/{well_id}/historical-context")
def get_historical_context_endpoint(well_id: str, timestamp: str):
    _validate_well(well_id)
    _validate_timestamp(timestamp)
    ctx = get_historical_context(timestamp)
    if not ctx:
        raise NoDataError()
    return ctx

@app.get("/api/v1/wells/{well_id}/snapshot")
def get_snapshot(well_id: str, timestamp: str):
    _validate_well(well_id)
    _validate_timestamp(timestamp)
    snap = build_snapshot(well_id, timestamp)
    if not snap.get("risk"):
        raise NoDataError()
    return snap
