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

    def get_latest_before_or_at(self, dataset: list, ts_list: list, target_ts: str):
        """Finds the chronologically latest record at or before target_ts."""
        if not ts_list or not target_ts:
            return None
        idx = bisect_right(ts_list, target_ts)
        if idx == 0:
            return None
        return dataset[idx - 1]
        
    def get_models_at(self, target_ts: str):
        """Models might have multiple records per timestamp."""
        res = [m for m in self.models if m.get("timestamp") == target_ts]
        return res
        
    def get_timeline(self, dataset: list, start_time: str = None, end_time: str = None, limit: int = 500):
        res = dataset
        if start_time:
            res = [r for r in res if r.get("timestamp") >= start_time]
        if end_time:
            res = [r for r in res if r.get("timestamp") <= end_time]
        return res[:limit]
        
data_service = DataService()
