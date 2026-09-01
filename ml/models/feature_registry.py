from typing import List, Dict

# Explicit definition of features to extract from M0.4 output
# Exclusions are documented in comments.

MODEL_FEATURE_REGISTRY: Dict[str, List[str]] = {
    "quality_context": [
        "time_delta_seconds",
        "source_gap_flag"
    ],
    "dynamic_signals": [
        "hookload.roll_medium_mean",
        "standpipe_pressure.roll_short_std",
        "block_position.delta",
        "hookload.meaningful_change",
        "standpipe_pressure.meaningful_change"
    ],
    "cross_channel": [
        "hookload_bpos_diff",
        "roll_medium_sppa_hkld_corr"
    ]
}

# Explicitly excluded features (constant or non-discriminating in WELL-1)
# - rotary_speed.* (constant zero)
# - weight_on_bit.* (constant zero)
# - rate_of_penetration.* (constant in this dataset)

def get_ordered_feature_names() -> List[str]:
    """
    Returns a deterministic, fixed-order list of feature names.
    This guarantees that every model sees exactly the same feature dimensions in the same order.
    """
    ordered_features = []
    # Always iterate in the same order
    for category in ["quality_context", "dynamic_signals", "cross_channel"]:
        ordered_features.extend(MODEL_FEATURE_REGISTRY[category])
    return ordered_features
