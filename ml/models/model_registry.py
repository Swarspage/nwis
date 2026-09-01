from typing import Dict, Any

from .anomaly_model import AnomalyModel
from .state_model import StateModel
from .temporal_model import TemporalModel

def get_model_registry() -> Dict[str, Any]:
    """
    Returns the instantiated models for M0.6.
    These models must implement:
      fit(X_train: List[List[float]])
      predict(record: ModelReadyRecord, X_imputed: List[float]) -> dict
    """
    return {
        "anomaly_isolation_forest": AnomalyModel(random_state=42),
        "behavioral_cluster": StateModel(n_clusters=3, random_state=42),
        "temporal_baseline": TemporalModel(history_size=15)
    }
