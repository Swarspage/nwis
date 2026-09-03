import json
import os
from bisect import bisect_right
from .config import config

class DataService:
    def __init__(self):
        # Data indexed by timestamp
        self.telemetry = []
        self.intelligence = []
        self.models = []
        self.knowledge = []
        self.historical_events = []
        self.risk = []
        self.summary = {}
        self.synthetic = {}
        
        self.telemetry_ts = []
        self.intelligence_ts = []
        self.models_ts = []
        self.risk_ts = []
        
        self._load_data()

    def _load_jsonl(self, path: str):
        data = []
        if os.path.exists(path):
            with open(path, 'r') as f:
                for line in f:
                    if line.strip():
                        data.append(json.loads(line))
        return data

    def _load_data(self):
        self.telemetry = self._load_jsonl(config.WELL1_TELEMETRY)
        self.telemetry_ts = [r.get("timestamp") for r in self.telemetry if r.get("timestamp")]
        
        self.intelligence = self._load_jsonl(config.WELL1_INTELLIGENCE)
        self.intelligence_ts = [r.get("timestamp") for r in self.intelligence if r.get("timestamp")]
        
        self.models = self._load_jsonl(config.WELL1_MODELS)
        self.models_ts = sorted(list(set(r.get("timestamp") for r in self.models if r.get("timestamp"))))
        
        self.historical_events = self._load_jsonl(config.WELL1_HISTORICAL)
        self.knowledge = self._load_jsonl(config.WELL1_KNOWLEDGE)
        
        self.risk = self._load_jsonl(config.WELL1_RISK)
        self.risk_ts = [r.get("timestamp") for r in self.risk if r.get("timestamp")]
        
        if os.path.exists(config.WELL1_RISK_SUMMARY):
            with open(config.WELL1_RISK_SUMMARY, 'r') as f:
                self.summary = json.load(f)
                
        # Load synthetic wells
        sim_dir = os.path.join(config.DATA_DIR, "simulation")
        if os.path.exists(sim_dir):
            for i in range(2, 7):
                wid = f"WELL-{i}"
                self.synthetic[wid] = {
                    "telemetry": self._load_jsonl(os.path.join(sim_dir, f"well-{i}_telemetry.jsonl")),
                    "intelligence": self._load_jsonl(os.path.join(sim_dir, f"well-{i}_intelligence.jsonl")),
                    "models": self._load_jsonl(os.path.join(sim_dir, f"well-{i}_models.jsonl")),
                    "risk": self._load_jsonl(os.path.join(sim_dir, f"well-{i}_risk.jsonl")),
                }

        # Apply deterministic cascading demo simulation pass
        try:
            from .demo_simulation import apply_demo_simulation_pass
            apply_demo_simulation_pass(self)
        except Exception as e:
            print(f"[DataService] Warning: Demo simulation pass failed: {e}")


    def get_dataset(self, well_id: str, kind: str):
        if well_id == "WELL-1":
            if kind == "telemetry": return self.telemetry
            if kind == "intelligence": return self.intelligence
            if kind == "models": return self.models
            if kind == "risk": return self.risk
            if kind == "historical_events": return self.historical_events
        else:
            if well_id in self.synthetic:
                if kind in self.synthetic[well_id]:
                    return self.synthetic[well_id][kind]
            return []
        return []
        
    def get_dataset_ts(self, well_id: str, kind: str):
        if well_id == "WELL-1":
            if kind == "telemetry": return self.telemetry_ts
            if kind == "intelligence": return self.intelligence_ts
            if kind == "models": return self.models_ts
            if kind == "risk": return self.risk_ts
        else:
            ds = self.get_dataset(well_id, kind)
            if kind == "models":
                return sorted(list(set(r.get("timestamp") for r in ds if r.get("timestamp"))))
            else:
                return [r.get("timestamp") for r in ds if r.get("timestamp")]
        return []

    def get_latest_before_or_at(self, dataset: list, ts_list: list, target_ts: str):
        """Finds the chronologically latest record at or before target_ts."""
        if not ts_list or not target_ts:
            return None
        idx = bisect_right(ts_list, target_ts)
        if idx == 0:
            return None
        return dataset[idx - 1]
        
    def get_models_at(self, well_id: str, target_ts: str):
        ds = self.get_dataset(well_id, "models")
        return [m for m in ds if m.get("timestamp") == target_ts]
        
    def get_timeline(self, dataset: list, start_time: str = None, end_time: str = None, limit: int = 500):
        res = dataset
        if start_time:
            res = [r for r in res if r.get("timestamp") >= start_time]
        if end_time:
            res = [r for r in res if r.get("timestamp") <= end_time]
        return res[:limit]
        
    def get_geometry(self, well_id: str, timestamp: str = None):
        from ml.geometry.mock_data import get_well_geometry
        current_depth = None
        if well_id != "WELL-1" and timestamp:
            telemetry_ds = self.get_dataset(well_id, "telemetry")
            telemetry_ts = self.get_dataset_ts(well_id, "telemetry")
            tel = self.get_latest_before_or_at(telemetry_ds, telemetry_ts, timestamp)
            if tel:
                current_depth = tel.get("simulation_context", {}).get("depth", {}).get("value")
        return get_well_geometry(well_id, current_depth)

    def get_offsets(self, well_id: str, timestamp: str = None):
        from ml.geometry.engine import calculate_offset_relationships
        current_depth = None
        if well_id != "WELL-1" and timestamp:
            telemetry_ds = self.get_dataset(well_id, "telemetry")
            telemetry_ts = self.get_dataset_ts(well_id, "telemetry")
            tel = self.get_latest_before_or_at(telemetry_ds, telemetry_ts, timestamp)
            if tel:
                current_depth = tel.get("simulation_context", {}).get("depth", {}).get("value")
        all_wells = ["WELL-1", "WELL-2", "WELL-3", "WELL-4", "WELL-5", "WELL-6"]
        offsets = [w for w in all_wells if w != well_id]
        return calculate_offset_relationships(well_id, offsets, current_depth)

    def get_historical_evidence(self, well_id: str, timestamp: str = None):
        raw_events = self.get_dataset(well_id, "historical_events")
        formatted_events = []
        for raw in raw_events:
            start_ts = raw.get("start_timestamp") or raw.get("start_time")
            end_ts = raw.get("end_timestamp") or raw.get("end_time")
            md_s = raw.get("md_start") or raw.get("depth_start") or raw.get("depth_ft")
            md_e = raw.get("md_end") or raw.get("depth_end")
            tvd_s = raw.get("tvd_start")
            tvd_e = raw.get("tvd_end")
            
            event_obj = {
                "event_id": raw.get("event_id"),
                "well_id": raw.get("well_id", well_id),
                "event_type": raw.get("event_type", "UNKNOWN"),
                "confirmation_status": raw.get("confirmation_status") or raw.get("verification_status") or "UNCONFIRMED",
                "start_timestamp": start_ts,
                "end_timestamp": end_ts,
                "md_start": md_s,
                "md_end": md_e,
                "tvd_start": tvd_s,
                "tvd_end": tvd_e,
                "depth_alignment_status": raw.get("depth_alignment_status") or ("VERIFIED" if (md_s is not None or tvd_s is not None) else "UNAVAILABLE"),
                "source": raw.get("source"),
                "provenance": raw.get("provenance") or ("SYNTHETIC_SIMULATION_NON_AUTHORITATIVE" if raw.get("data_origin") == "SYNTHETIC_DEMO" else "VLOVE_HISTORICAL_TELEMETRY"),
                "data_origin": raw.get("data_origin", "HISTORICAL_SOURCE" if well_id == "WELL-1" else "SYNTHETIC_DEMO"),
                "validation_status": raw.get("validation_status") or raw.get("verification_status"),
                "limitations": raw.get("limitations") or (["NO_GEOMETRY_AVAILABLE"] if well_id == "WELL-1" else [])
            }
            
            if timestamp and start_ts and start_ts > timestamp:
                continue
                
            formatted_events.append(event_obj)
            
        count = len(formatted_events)
        status_msg = "OK" if count > 0 else ("NO_VERIFIED_HISTORICAL_EVENTS_AVAILABLE" if well_id == "WELL-1" else "NO_HISTORICAL_EVENTS_IN_DEMO_SCENARIO")
        note_msg = "No authoritative historical event records are currently available for this well. Telemetry-derived anomalies are not treated as confirmed historical events." if count == 0 else ""
        
        return {
            "well_id": well_id,
            "count": count,
            "events": formatted_events,
            "status": status_msg,
            "note": note_msg
        }

    def get_offset_intelligence(self, well_id: str, timestamp: str = None, look_ahead_window_ft: float = 500.0):
        from ml.offset_intelligence import OffsetIntelligenceEngine
        from .replay_service import build_snapshot
        
        # 1. Retrieve current well snapshot (replay-safe)
        if well_id == "WELL-1":
            snapshot = build_snapshot(well_id, timestamp) if timestamp else {}
        else:
            ts = timestamp or (self.telemetry_ts[-1] if self.telemetry_ts else None)
            ds_risk = self.get_dataset(well_id, "risk")
            ds_risk_ts = self.get_dataset_ts(well_id, "risk")
            risk = self.get_latest_before_or_at(ds_risk, ds_risk_ts, ts)
            actual_ts = risk["timestamp"] if risk else ts
            tel = self.get_latest_before_or_at(self.get_dataset(well_id, "telemetry"), self.get_dataset_ts(well_id, "telemetry"), actual_ts)
            intel = self.get_latest_before_or_at(self.get_dataset(well_id, "intelligence"), self.get_dataset_ts(well_id, "intelligence"), actual_ts)
            models = self.get_models_at(well_id, actual_ts) if actual_ts else []
            snapshot = {
                "well_id": well_id,
                "timestamp": actual_ts,
                "telemetry": tel or {},
                "intelligence": intel or {},
                "models": models or [],
                "risk": risk or {}
            }

        # 2. Retrieve spatial relationships for candidate wells
        spatial_rels = [r.model_dump() for r in self.get_offsets(well_id, timestamp)]
        
        # 3. Retrieve raw historical events for candidate offsets
        raw_events = []
        all_wells = ["WELL-1", "WELL-2", "WELL-3", "WELL-4", "WELL-5", "WELL-6"]
        candidate_ids = [w for w in all_wells if w != well_id]
        
        for cand_id in candidate_ids:
            ev_data = self.get_historical_evidence(cand_id, timestamp)
            if isinstance(ev_data, dict) and "events" in ev_data:
                raw_events.extend(ev_data["events"])

        # 4. Evaluate Guidance
        from ml.guidance.engine import evaluate_guidance
        guidance = evaluate_guidance(snapshot)
        guidance_dict = guidance.model_dump() if hasattr(guidance, "model_dump") else {}

        # 5. Evaluate Offset Intelligence Engine
        engine = OffsetIntelligenceEngine()
        result = engine.evaluate(
            well_id=well_id,
            timestamp=timestamp,
            snapshot=snapshot,
            candidate_well_ids=candidate_ids,
            spatial_relationships=spatial_rels,
            raw_historical_events=raw_events,
            guidance_data=guidance_dict,
            look_ahead_window_ft=look_ahead_window_ft
        )
        
        return result.model_dump()

data_service = DataService()

