import math
from typing import List, Optional, Tuple
from .dataset_adapter import ModelReadyRecord
from .feature_registry import get_ordered_feature_names

class Preprocessor:
    """
    Stateful preprocessing component.
    Imputes missing numerical values with the training-window median.
    Preserves the missingness indicator mask.
    Fits only on the warm-up data; frozen for future inference.
    """
    def __init__(self):
        self.feature_names = get_ordered_feature_names()
        self.medians: List[float] = []
        self.is_fitted = False
        
    def fit(self, warmup_records: List[ModelReadyRecord]):
        """
        Calculates imputation statistics (median) using ONLY the warm-up data.
        """
        if not warmup_records:
            raise ValueError("Cannot fit preprocessor with 0 warmup records.")
            
        n_features = len(self.feature_names)
        self.medians = [0.0] * n_features
        
        for i in range(n_features):
            # Extract valid values for this feature across all warmup records
            vals = []
            for r in warmup_records:
                val = r.features[i]
                if not math.isnan(val):
                    vals.append(val)
            
            # Calculate median
            if not vals:
                # If a feature is 100% missing in warmup, we default to 0.0 but it will 
                # constantly have missing_mask=1, so models will learn to ignore it 
                # or treat it as constantly missing.
                self.medians[i] = 0.0
            else:
                vals.sort()
                mid = len(vals) // 2
                if len(vals) % 2 == 0:
                    self.medians[i] = (vals[mid - 1] + vals[mid]) / 2.0
                else:
                    self.medians[i] = vals[mid]
                    
        self.is_fitted = True

    def transform(self, record: ModelReadyRecord) -> Tuple[List[float], List[int]]:
        """
        Transforms a single inference record using frozen statistics.
        Returns:
            imputed_features: list of floats where NaNs are replaced by the fit median.
            missing_mask: list of ints (1 if original was missing, 0 otherwise).
        """
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted before transform.")
            
        n_features = len(self.feature_names)
        imputed_features = []
        
        for i in range(n_features):
            val = record.features[i]
            if math.isnan(val):
                imputed_features.append(self.medians[i])
            else:
                imputed_features.append(val)
                
        return imputed_features, record.missing_mask
