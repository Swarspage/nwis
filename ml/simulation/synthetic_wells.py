import random
from datetime import datetime, timedelta
import math

CANONICAL_FIELDS = [
    "depth", "rate_of_penetration", "weight_on_bit", "rotary_speed", 
    "torque", "standpipe_pressure", "flow_rate", "hookload", "block_position"
]

def _safe_val(v):
    if v is None: return None
    return round(float(v), 4)

class SyntheticGenerator:
    def __init__(self, seed: int, start_time: datetime, step_seconds: int = 5):
        self.rng = random.Random(seed)
        self.current_time = start_time
        self.step_seconds = step_seconds
        self.t_index = 0
        self.simulated_depth = 8420.0 # Will be set via argument
        
        # Baselines
        self.state = {
            "rate_of_penetration": 25.0,
            "weight_on_bit": 15.0,
            "rotary_speed": 120.0,
            "torque": 10.0,
            "standpipe_pressure": 2500.0,
            "flow_rate": 600.0,
            "hookload": 200.0,
            "block_position": 90.0,
        }
        
    def _add_noise(self, val, noise_level):
        return val + self.rng.gauss(0, noise_level)
        
    def _drift(self, field, target, rate):
        diff = target - self.state[field]
        self.state[field] += diff * rate
        
    def step(self, profile: str):
        """Advances the internal state by one step based on the profile scenario."""
        # 1. Natural Baseline Noise & Drift
        self.state["rate_of_penetration"] = self._add_noise(self.state["rate_of_penetration"], 0.2)
        self.state["weight_on_bit"] = self._add_noise(self.state["weight_on_bit"], 0.1)
        self.state["rotary_speed"] = self._add_noise(self.state["rotary_speed"], 1.0)
        self.state["torque"] = self._add_noise(self.state["torque"], 0.05)
        self.state["standpipe_pressure"] = self._add_noise(self.state["standpipe_pressure"], 5.0)
        self.state["flow_rate"] = self._add_noise(self.state["flow_rate"], 1.0)
        self.state["hookload"] = self._add_noise(self.state["hookload"], 0.5)
        
        # Block position descends while drilling
        self.state["block_position"] -= (self.state["rate_of_penetration"] / 3600.0) * self.step_seconds
        if self.state["block_position"] < 10:
            self.state["block_position"] = 90.0 # reset block
            
        # 2. Scenario specific deviations
        if profile == "NORMAL":
            pass # just noise
            
        elif profile == "DEVELOPING_DEVIATION":
            # Pressure slowly increases over time, flow slightly drops
            if self.t_index > 100:
                self._drift("standpipe_pressure", 2800.0, 0.005)
                self._drift("flow_rate", 550.0, 0.002)
                
        elif profile == "ANOMALOUS":
            # Sharp torque and pressure spikes starting at t=150, ending at t=250
            if 150 <= self.t_index <= 250:
                self.state["torque"] += self.rng.gauss(2.0, 0.5)
                self.state["standpipe_pressure"] += self.rng.gauss(300.0, 50.0)
                self.state["rotary_speed"] -= self.rng.gauss(20.0, 5.0)
                
        elif profile == "ELEVATED_RISK":
            # Complete collapse of normal drilling parameters starting at t=50
            if self.t_index > 50:
                self._drift("standpipe_pressure", 3500.0, 0.01) # big spike
                self._drift("rate_of_penetration", 5.0, 0.05)
                self._drift("torque", 18.0, 0.01)
                self._drift("rotary_speed", 40.0, 0.05)
                self._drift("hookload", 250.0, 0.01)
                
        elif profile == "RECOVERY":
            # Starts in elevated state, returns to normal
            if self.t_index == 0:
                self.state["standpipe_pressure"] = 3200.0
                self.state["torque"] = 15.0
                self.state["rate_of_penetration"] = 10.0
            
            if self.t_index > 50:
                self._drift("standpipe_pressure", 2500.0, 0.01)
                self._drift("torque", 10.0, 0.01)
                self._drift("rate_of_penetration", 25.0, 0.01)
        
        # Advance time
        ts_iso = self.current_time.isoformat()
        if not ts_iso.endswith("+00:00"):
            ts_iso += "+00:00"
            
        # Update simulated depth strictly based on ROP
        drilled_distance = (self.state["rate_of_penetration"] / 3600.0) * self.step_seconds
        self.simulated_depth += drilled_distance
            
        self.current_time += timedelta(seconds=self.step_seconds)
        self.t_index += 1
        
        return ts_iso
        
    def generate_record(self, well_id: str, profile: str) -> dict:
        ts = self.step(profile)
        
        measurements = {}
        for f in CANONICAL_FIELDS:
            if f == "depth":
                measurements[f] = {"value": None, "quality": "MISSING"}
            else:
                val = self.state.get(f)
                measurements[f] = {"value": _safe_val(val), "quality": "UNVERIFIED"}
                
        return {
            "schema_version": "0.1.0",
            "timestamp": ts,
            "well_id": well_id,
            "source_system": "SYNTHETIC",
            "source_well_id": well_id,
            "source_row_index": self.t_index,
            "data_origin": "SYNTHETIC_DEMO",
            "telemetry_status": "ACTIVE",
            "simulation": True,
            "simulation_context": {
                "depth": {
                    "value": round(self.simulated_depth, 4),
                    "unit": "ft",
                    "semantics": "SYNTHETIC_SIMULATION",
                    "source": "synthetic_rop_progression"
                }
            },
            "measurements": measurements
        }

def get_well_profile(well_id: str) -> str:
    mapping = {
        "WELL-2": "NORMAL",
        "WELL-3": "DEVELOPING_DEVIATION",
        "WELL-4": "ANOMALOUS",
        "WELL-5": "ELEVATED_RISK",
        "WELL-6": "RECOVERY",
    }
    return mapping.get(well_id, "NORMAL")

def get_initial_simulated_depth_ft(well_id: str) -> float:
    mapping = {
        "WELL-2": 8200.0,
        "WELL-3": 8420.0,
        "WELL-4": 8600.0,
        "WELL-5": 8800.0,
        "WELL-6": 9000.0,
    }
    return mapping.get(well_id, 8420.0)
