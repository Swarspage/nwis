from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .config import config
from .errors import APIError, api_error_handler, WellNotFoundError, NoDataError, InvalidTimestampError
from .data_service import data_service
from .replay_service import build_snapshot, get_historical_context

from .simulation_service import simulation_clock

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
    if well_id not in ["WELL-1", "WELL-2", "WELL-3", "WELL-4", "WELL-5", "WELL-6"]:
        raise WellNotFoundError()

def _clamp_to_sim_time(well_id: str, ts: str = None):
    """If synthetic well, ensure we don't query past simulation clock."""
    if well_id == "WELL-1":
        return ts
    current_sim_time = simulation_clock.get_current_time_iso()
    if ts is None or ts > current_sim_time:
        return current_sim_time
    return ts

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "service": "nwis-api",
        "api_version": config.API_VERSION
    }
    
@app.get("/api/v1/simulation/status")
def get_sim_status():
    return simulation_clock.get_status()
    
from pydantic import BaseModel
class SimControlParams(BaseModel):
    action: str
    speed: Optional[float] = None
    mode: Optional[str] = None
    
@app.post("/api/v1/simulation/control")
def control_sim(params: SimControlParams):
    if params.action == "start":
        simulation_clock.start(params.mode)
    elif params.action == "pause":
        simulation_clock.pause()
    elif params.action == "reset":
        simulation_clock.reset()
    elif params.action == "speed" and params.speed is not None:
        simulation_clock.set_speed(params.speed)
    return simulation_clock.get_status()

@app.get("/api/v1/wells")
def list_wells():
    return {
        "wells": [
            {"well_id": "WELL-1", "source_system": "VLOVE", "data_origin": "HISTORICAL_SOURCE"},
            {"well_id": "WELL-2", "source_system": "SYNTHETIC", "data_origin": "SYNTHETIC_DEMO"},
            {"well_id": "WELL-3", "source_system": "SYNTHETIC", "data_origin": "SYNTHETIC_DEMO"},
            {"well_id": "WELL-4", "source_system": "SYNTHETIC", "data_origin": "SYNTHETIC_DEMO"},
            {"well_id": "WELL-5", "source_system": "SYNTHETIC", "data_origin": "SYNTHETIC_DEMO"},
            {"well_id": "WELL-6", "source_system": "SYNTHETIC", "data_origin": "SYNTHETIC_DEMO"},
        ]
    }

@app.get("/api/v1/wells/{well_id}/summary")
def get_well_summary(well_id: str):
    _validate_well(well_id)
    if well_id == "WELL-1":
        if not data_service.summary:
            raise NoDataError()
        return data_service.summary
    else:
        return {
            "well_id": well_id,
            "m05_intelligence_available": True,
            "m06_statistical_models_available": True,
            "m07_verified_historical_events_available": 0,
            "supervised_event_labels_available": 0,
            "note": "Synthetic demonstration profile."
        }

@app.get("/api/v1/wells/{well_id}/risk/current")
def get_current_risk(well_id: str):
    _validate_well(well_id)
    dataset = data_service.get_dataset(well_id, "risk")
    if well_id == "WELL-1":
        if not dataset: raise NoDataError()
        return dataset[-1]
    
    current_time = simulation_clock.get_current_time_iso()
    ts_list = data_service.get_dataset_ts(well_id, "risk")
    rec = data_service.get_latest_before_or_at(dataset, ts_list, current_time)
    if not rec: raise NoDataError()
    return rec

import re

def _validate_timestamp(ts: str):
    if not ts:
        raise InvalidTimestampError("Timestamp cannot be empty.")
    if not re.match(r"^\d{4}-\d{2}-\d{2}", ts):
        raise InvalidTimestampError("Timestamp must be in ISO-8601 format.")

@app.get("/api/v1/wells/{well_id}/risk")
def get_risk_at_timestamp(well_id: str, timestamp: str):
    _validate_well(well_id)
    _validate_timestamp(timestamp)
    ts = _clamp_to_sim_time(well_id, timestamp)
    rec = data_service.get_latest_before_or_at(
        data_service.get_dataset(well_id, "risk"), 
        data_service.get_dataset_ts(well_id, "risk"), 
        ts
    )
    if not rec: raise NoDataError()
    return rec

@app.get("/api/v1/wells/{well_id}/risk/timeline")
def get_risk_timeline(well_id: str, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    end_time = _clamp_to_sim_time(well_id, end_time)
    records = data_service.get_timeline(data_service.get_dataset(well_id, "risk"), start_time, end_time, limit)
    return {"well_id": well_id, "count": len(records), "records": records}

@app.get("/api/v1/wells/{well_id}/telemetry")
def get_telemetry(well_id: str, timestamp: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    if timestamp:
        ts = _clamp_to_sim_time(well_id, timestamp)
        rec = data_service.get_latest_before_or_at(data_service.get_dataset(well_id, "telemetry"), data_service.get_dataset_ts(well_id, "telemetry"), ts)
        records = [rec] if rec else []
    else:
        end_time = _clamp_to_sim_time(well_id, end_time)
        records = data_service.get_timeline(data_service.get_dataset(well_id, "telemetry"), start_time, end_time, limit)
        
    return {"well_id": well_id, "count": len(records), "records": records}

@app.get("/api/v1/wells/{well_id}/intelligence")
def get_intelligence(well_id: str, timestamp: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    if timestamp:
        ts = _clamp_to_sim_time(well_id, timestamp)
        rec = data_service.get_latest_before_or_at(data_service.get_dataset(well_id, "intelligence"), data_service.get_dataset_ts(well_id, "intelligence"), ts)
        records = [rec] if rec else []
    else:
        end_time = _clamp_to_sim_time(well_id, end_time)
        records = data_service.get_timeline(data_service.get_dataset(well_id, "intelligence"), start_time, end_time, limit)
        
    return {"well_id": well_id, "count": len(records), "records": records}

@app.get("/api/v1/wells/{well_id}/models")
def get_models(well_id: str, timestamp: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None, limit: int = 500):
    _validate_well(well_id)
    if timestamp:
        ts = _clamp_to_sim_time(well_id, timestamp)
        # Using nearest preceding timestamp matching
        latest_risk = data_service.get_latest_before_or_at(data_service.get_dataset(well_id, "risk"), data_service.get_dataset_ts(well_id, "risk"), ts)
        if latest_risk:
            records = data_service.get_models_at(well_id, latest_risk["timestamp"])
        else:
            records = []
    else:
        end_time = _clamp_to_sim_time(well_id, end_time)
        records = data_service.get_timeline(data_service.get_dataset(well_id, "models"), start_time, end_time, limit)
        
    return {"well_id": well_id, "count": len(records), "records": records}

@app.get("/api/v1/wells/{well_id}/historical-events")
def get_historical_events(well_id: str):
    _validate_well(well_id)
    events = data_service.get_dataset(well_id, "historical_events")
    count = len(events)
    return {
        "well_id": well_id,
        "count": count,
        "events": events,
        "status": "NO_VERIFIED_HISTORICAL_EVENTS_AVAILABLE" if count == 0 else "OK"
    }

@app.get("/api/v1/wells/{well_id}/historical-context")
def get_historical_context_endpoint(well_id: str, timestamp: str):
    _validate_well(well_id)
    _validate_timestamp(timestamp)
    if well_id == "WELL-1":
        ctx = get_historical_context(timestamp)
        if not ctx: raise NoDataError()
        return ctx
    else:
        raise NoDataError()

@app.get("/api/v1/wells/{well_id}/snapshot")
def get_snapshot(well_id: str, timestamp: str):
    _validate_well(well_id)
    _validate_timestamp(timestamp)
    ts = _clamp_to_sim_time(well_id, timestamp)
    
    if well_id == "WELL-1":
        snap = build_snapshot(well_id, ts)
        if not snap.get("risk"): raise NoDataError()
        return snap
    else:
        # Build synthetic snapshot
        ds_risk = data_service.get_dataset(well_id, "risk")
        ds_risk_ts = data_service.get_dataset_ts(well_id, "risk")
        risk = data_service.get_latest_before_or_at(ds_risk, ds_risk_ts, ts)
        if not risk: raise NoDataError()
        
        actual_ts = risk["timestamp"]
        
        ds_tel = data_service.get_dataset(well_id, "telemetry")
        ds_tel_ts = data_service.get_dataset_ts(well_id, "telemetry")
        tel = data_service.get_latest_before_or_at(ds_tel, ds_tel_ts, actual_ts)
        
        ds_int = data_service.get_dataset(well_id, "intelligence")
        ds_int_ts = data_service.get_dataset_ts(well_id, "intelligence")
        intel = data_service.get_latest_before_or_at(ds_int, ds_int_ts, actual_ts)
        
        models = data_service.get_models_at(well_id, actual_ts)
        
        return {
            "well_id": well_id,
            "timestamp": actual_ts,
            "telemetry": tel,
            "intelligence": intel,
            "models": models,
            "risk": risk
        }
