import numpy as np
from typing import List, Dict, Any
from sklearn.cluster import KMeans

from .dataset_adapter import ModelReadyRecord
from .feature_registry import get_ordered_feature_names

class StateModel:
    """
    Unsupervised K-Means for behavioral clustering.
    Discovers behavioral states from fixed feature space.
    Does NOT assign physical meanings (e.g. DRILLING, TRIPPING).
    """
    def __init__(self, n_clusters: int = 3, random_state: int = 42):
        self.model_name = "behavioral_cluster"
        self.model_version = "0.1.0"
        # Use n_init explicitly to avoid sklearn warnings
        self.clf = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
        self.is_fitted = False
        self.feature_names = get_ordered_feature_names()

    def fit(self, X_train: List[List[float]]):
        """
        Fits K-Means on the preprocessed warm-up data.
        X_train must have no NaNs.
        """
        if not X_train:
            raise ValueError("Cannot fit with empty training data.")
        
        X = np.array(X_train)
        if np.isnan(X).any():
            raise ValueError("X_train contains NaN. Preprocessing must handle imputation.")
            
        self.clf.fit(X)
        self.is_fitted = True

    def predict(self, record: ModelReadyRecord, X_imputed: List[float]) -> Dict[str, Any]:
        """
        Predicts behavioral cluster for a single record.
        X_imputed is the preprocessed feature vector (no NaNs).
        """
        if not self.is_fitted:
            return self._unavailable_result(record, "INSUFFICIENT_DATA")

        missing_count = sum(record.missing_mask)
        total_features = len(self.feature_names)
        coverage = 1.0 - (missing_count / total_features) if total_features > 0 else 0.0

        if coverage < 0.5:
            status = "LOW_COVERAGE"
        else:
            status = "SUCCESS"

        X = np.array(X_imputed).reshape(1, -1)
        
        cluster_idx = self.clf.predict(X)[0]
        label = f"STATE_{cluster_idx}"
        
        # Calculate distance to centroid as a pseudo-confidence/score metric
        centroid = self.clf.cluster_centers_[cluster_idx]
        distance = float(np.linalg.norm(X[0] - centroid))
        
        # We can map distance to an arbitrary score or just provide the distance
        score = distance

        evidence = []
        if status == "LOW_COVERAGE":
            evidence.append({
                "feature": "coverage",
                "contribution": 1.0,
                "direction": "LOW"
            })
        else:
            evidence.append({
                "feature": "centroid_distance",
                "contribution": 1.0,
                "direction": "NORMAL"
            })

        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "timestamp": record.timestamp,
            "well_id": record.well_id,
            "data_origin": record.data_origin,
            "status": status,
            "score": score,
            "label": label,
            "confidence": coverage,
            "feature_coverage": coverage,
            "evidence": evidence,
            "source_row_index": record.source_row_index
        }

    def _unavailable_result(self, record: ModelReadyRecord, status: str) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "timestamp": record.timestamp,
            "well_id": record.well_id,
            "data_origin": record.data_origin,
            "status": status,
            "score": None,
            "label": None,
            "confidence": None,
            "feature_coverage": None,
            "evidence": None,
            "source_row_index": record.source_row_index
        }
