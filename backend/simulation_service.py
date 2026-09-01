import time
from datetime import datetime, timezone, timedelta

class SimulationClock:
    def __init__(self):
        self.mode = "REPLAY" # "REPLAY" or "LIVE_SIMULATION"
        self.status = "PAUSED" # "PLAYING" or "PAUSED"
        self.speed = 1.0
        
        # Real-world anchors
        self.real_start_time = None
        self.last_update_real = time.time()
        
        # Simulation anchors
        # The synthetic data starts at 2026-01-01T00:00:00+00:00
        self.sim_start_time = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        self.current_sim_time = self.sim_start_time
        
    def start(self, mode: str = None):
        if mode:
            self.mode = mode
        if self.status != "PLAYING":
            self.status = "PLAYING"
            self.last_update_real = time.time()
            
    def pause(self):
        self._update_clock()
        self.status = "PAUSED"
        
    def reset(self):
        self.status = "PAUSED"
        self.current_sim_time = self.sim_start_time
        self.last_update_real = time.time()
        
    def set_speed(self, speed: float):
        self._update_clock()
        self.speed = speed
        self.last_update_real = time.time()
        
    def _update_clock(self):
        now = time.time()
        if self.status == "PLAYING":
            elapsed_real = now - self.last_update_real
            elapsed_sim = elapsed_real * self.speed
            self.current_sim_time += timedelta(seconds=elapsed_sim)
        self.last_update_real = now

    def get_current_time_iso(self) -> str:
        self._update_clock()
        iso = self.current_sim_time.isoformat()
        if not iso.endswith("+00:00"):
            iso += "+00:00"
        return iso
        
    def get_status(self):
        self._update_clock()
        return {
            "mode": self.mode,
            "status": self.status,
            "speed": self.speed,
            "current_sim_time": self.get_current_time_iso(),
            "sim_start_time": self.sim_start_time.isoformat() + "+00:00" if not self.sim_start_time.isoformat().endswith("+00:00") else self.sim_start_time.isoformat()
        }

simulation_clock = SimulationClock()
