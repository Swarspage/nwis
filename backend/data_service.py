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
        
data_service = DataService()
