import numpy as np
from typing import List, Dict, Any
from sklearn.ensemble import IsolationForest

from .dataset_adapter import ModelReadyRecord
from .feature_registry import get_ordered_feature_names

class AnomalyModel:
    """
    Unsupervised Isolation Forest for anomaly detection.
    Detects statistical deviations in the fixed feature space.
    Does NOT predict physical events (e.g., kicks or stuck pipe).
    """
    def __init__(self, random_state: int = 42):
        self.model_name = "anomaly_isolation_forest"
        self.model_version = "0.1.0"
        self.clf = IsolationForest(
            n_estimators=100, 
            contamination='auto', 
            random_state=random_state
        )
        self.is_fitted = False
        self.feature_names = get_ordered_feature_names()

    def fit(self, X_train: List[List[float]]):
        """
        Fits the Isolation Forest on the preprocessed warm-up data.
        X_train must have no NaNs.
        """
        if not X_train:
            raise ValueError("Cannot fit with empty training data.")
        
        # IsolationForest requires 2D array
        X = np.array(X_train)
        if np.isnan(X).any():
            raise ValueError("X_train contains NaN. Preprocessing must handle imputation.")
            
        self.clf.fit(X)
        self.is_fitted = True

    def predict(self, record: ModelReadyRecord, X_imputed: List[float]) -> Dict[str, Any]:
        """
        Predicts anomaly score for a single record.
        X_imputed is the preprocessed feature vector (no NaNs).
        """
        if not self.is_fitted:
            return self._unavailable_result(record, "INSUFFICIENT_DATA")

        # Check coverage
        missing_count = sum(record.missing_mask)
        total_features = len(self.feature_names)
        coverage = 1.0 - (missing_count / total_features) if total_features > 0 else 0.0

        if coverage < 0.5:
            # Low coverage -> reduce confidence or cap output
            status = "LOW_COVERAGE"
        else:
            status = "SUCCESS"

        # Predict
        X = np.array(X_imputed).reshape(1, -1)
        
        # score_samples returns opposite of anomaly score. 
        # Lower means more anomalous. Range is roughly [-0.5, 0] for normal, and < -0.5 for anomalies.
        # We will normalize it to a 0-100 range where 100 is highly anomalous.
        raw_score = self.clf.score_samples(X)[0]
        
        # Normalization heuristic: map [-1.0, 0.0] -> [100, 0]
        # In sklearn IF, score is negative. 
        # So -raw_score is positive.
        norm_score = float(-raw_score * 150)
        norm_score = max(0.0, min(100.0, norm_score))

        label = "ANOMALOUS" if norm_score >= 60.0 else "NORMAL"
        confidence = coverage

        # Minimal evidence generation: just list top missing if low coverage, else general
        evidence = []
        if status == "LOW_COVERAGE":
            evidence.append({
                "feature": "coverage",
                "contribution": 1.0,
                "direction": "LOW"
            })
        else:
            # For IF, extracting exact feature contributions is non-trivial without SHAP,
            # so we provide a generic contribution for MVP.
            evidence.append({
                "feature": "isolation_path",
                "contribution": 1.0,
                "direction": "ABNORMAL" if label == "ANOMALOUS" else "NORMAL"
            })

        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "timestamp": record.timestamp,
            "well_id": record.well_id,
            "data_origin": record.data_origin,
            "status": status,
            "score": norm_score,
            "label": label,
            "confidence": confidence,
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
