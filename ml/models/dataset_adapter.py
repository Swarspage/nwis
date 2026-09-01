import math
from typing import Dict, Any, Tuple, Optional
from .feature_registry import get_ordered_feature_names

class ModelReadyRecord:
    def __init__(self,
                 well_id: str,
                 timestamp: str,
                 data_origin: str,
                 telemetry_status: str,
                 source_row_index: Optional[int],
                 features: list[float],
                 missing_mask: list[int]):
        self.well_id = well_id
        self.timestamp = timestamp
        self.data_origin = data_origin
        self.telemetry_status = telemetry_status
        self.source_row_index = source_row_index
        self.features = features  # None values remain None, nan remain nan (ideally shouldn't be nan in JSON, usually null/None)
        self.missing_mask = missing_mask

def _extract_feature_value(record: Dict[str, Any], feature_name: str) -> Optional[float]:
    """
    Extracts a feature value given its exact name (e.g. 'hookload.roll_medium_mean').
    Returns None if missing or invalid.
    """
    # Look directly in the known sub-objects
    for category in ["quality_features", "signal_features", "state_features", "relationship_features"]:
        if category in record and isinstance(record[category], dict):
            if feature_name in record[category]:
                current = record[category][feature_name]
                if current is None:
                    return None
                try:
                    val = float(current)
                    if math.isnan(val) or math.isinf(val):
                        return None
                    return val
                except (ValueError, TypeError):
                    return None
                    
    return None

def adapt_record(record: Dict[str, Any]) -> ModelReadyRecord:
    """
    Transforms a single M0.4 feature record into a model-ready format.
    Does NOT modify the input record.
    Missing values remain None (or NaN if converted to float arrays later), and are NOT zeroed.
    """
    ordered_names = get_ordered_feature_names()
    features = []
    missing_mask = []
    
    for name in ordered_names:
        val = _extract_feature_value(record, name)
        if val is None:
            features.append(float('nan'))
            missing_mask.append(1)
        else:
            features.append(val)
            missing_mask.append(0)
            
    # Extract provenance
    well_id = record.get("well_id", "UNKNOWN")
    timestamp = record.get("timestamp", "UNKNOWN")
    data_origin = record.get("data_origin", "UNKNOWN")
    telemetry_status = record.get("telemetry_status", "NORMAL")
    source_row_index = record.get("source_row_index")
    
    # Check if this record is a SOURCE_GAP flag from quality_features
    # This might be nested inside quality_features
    qf = record.get("quality_features", {})
    if qf.get("source_gap_flag") is True:
        telemetry_status = "SOURCE_GAP"
        
    return ModelReadyRecord(
        well_id=well_id,
        timestamp=timestamp,
        data_origin=data_origin,
        telemetry_status=telemetry_status,
        source_row_index=source_row_index,
        features=features,
        missing_mask=missing_mask
    )
