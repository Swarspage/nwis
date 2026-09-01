import numpy as np
from typing import List, Dict, Any
from collections import deque

from .dataset_adapter import ModelReadyRecord
from .feature_registry import get_ordered_feature_names

class TemporalModel:
    """
    Temporal Pattern Baseline.
    Compares the current observation against the recent rolling history
    to detect abrupt temporal deviation.
    """
    def __init__(self, history_size: int = 15):
        self.model_name = "temporal_baseline"
        self.model_version = "0.1.0"
        self.history_size = history_size
        self.history: deque = deque(maxlen=history_size)
        self.feature_names = get_ordered_feature_names()

    def fit(self, X_train: List[List[float]]):
        """
        No-op for TemporalModel.
        History is built chronologically during predict().
        """
        pass

    def predict(self, record: ModelReadyRecord, X_imputed: List[float]) -> Dict[str, Any]:
        """
        Predict temporal deviation for a single record.
        X_imputed is the preprocessed feature vector (no NaNs).
        Updates the internal rolling history AFTER scoring to prevent look-ahead.
        """
        if len(self.history) < max(3, self.history_size // 2):
            # Not enough history to form a stable baseline
            res = self._unavailable_result(record, "INSUFFICIENT_DATA")
            self.history.append(np.array(X_imputed))
            return res

        missing_count = sum(record.missing_mask)
        total_features = len(self.feature_names)
        coverage = 1.0 - (missing_count / total_features) if total_features > 0 else 0.0

        if coverage < 0.5:
            status = "LOW_COVERAGE"
        else:
            status = "SUCCESS"

        X = np.array(X_imputed)
        
        # Calculate historical median for each feature over the recent window
        hist_array = np.array(self.history)
        hist_median = np.median(hist_array, axis=0)
        
        # Deviation is Euclidean distance from the recent median
        deviation = float(np.linalg.norm(X - hist_median))

        evidence = []
        if status == "LOW_COVERAGE":
            evidence.append({
                "feature": "coverage",
                "contribution": 1.0,
                "direction": "LOW"
            })
        else:
            # Find the feature that contributes most to the deviation
            diffs = np.abs(X - hist_median)
            max_idx = int(np.argmax(diffs))
            evidence.append({
                "feature": self.feature_names[max_idx],
                "contribution": 1.0,  # Simplification for MVP
                "direction": "ABNORMAL"
            })

        # Push current record AFTER scoring
        self.history.append(X)

        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "timestamp": record.timestamp,
            "well_id": record.well_id,
            "data_origin": record.data_origin,
            "status": status,
            "score": deviation,
            "label": "PATTERN_CHANGE" if deviation > 10.0 else "STABLE", # Arbitrary threshold for MVP
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
