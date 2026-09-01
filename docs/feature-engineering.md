# NWIS Feature Engineering — v0.1.0

> **Status**: MVP/Prototype  
> **Feature version**: `0.1.0`  
> **Source**: [`ml/features/`](../ml/features/)  
> **Schema**: [`schemas/nwis_features.schema.json`](../schemas/nwis_features.schema.json)

---

## Purpose

This document defines every feature produced by the NWIS Feature Engine.  
For each feature family it specifies the formula, inputs, windows, limitations, and  
whether the feature is safe for future real-time (streaming) processing.

**Critical terminology distinction used throughout:**

| Term | Meaning |
|---|---|
| **OBSERVABLE SIGNAL** | A mathematical description of what the data shows |
| **ENGINEERING INTERPRETATION** | A physical claim about what is happening in the well |

This document only makes OBSERVABLE SIGNAL claims.  
Engineering interpretations require verified channel metadata, calibrated units, and domain expert review.

---

## Time Windows

All rolling features use **time-based** windows (seconds), not row counts.

| Window Label | Duration | Rationale |
|---|---|---|
| `short`  | **60 seconds**   | ~12 rows at median 4.9s interval; captures fast signal transients |
| `medium` | **300 seconds**  | ~61 rows; captures moderate-duration changes |
| `long`   | **1800 seconds** | ~367 rows; captures sustained trends |

**Why not row counts?**  
WELL-1 has variable inter-sample intervals (ranging from seconds to the 8.2-hour gap). Row-count windows would silently span that gap, mixing pre-gap and post-gap data. Time-based windows do not.

**Why `min_periods=1`?**  
Early rows in a window have fewer observations than the window duration. Rather than discarding them, `min_periods=1` computes with whatever is available. The `n_obs` sub-field reports how many observations contributed to each rolling statistic, so callers know when a window is sparsely populated.

**Abnormal interval threshold**: A time delta > **300 seconds** between consecutive records is flagged as `time_gap_flag=1`. This equals 5× the dataset's p99 inter-sample interval. It is a heuristic, not a physical gap definition.

---

## Leakage Safeguards

- Rolling windows use `pandas.Series.rolling(window='Xs')` which is causal — at row t, only data with timestamps in `[t - X seconds, t]` is used.  
- The entire feature computation is a **single vectorized pass** over the time-ordered DataFrame. There is no shuffle or future-row access.  
- `compute_all_signal_features()` returns one feature dict per row, each computed using only the window terminating at that row's timestamp.
- The validation test `No look-ahead: first record rolling n_obs <= 1` verifies this property.

---

## Missing-Value Policy in Features

| Situation | Feature value |
|---|---|
| Source measurement was null | Feature is `null` |
| Source measurement was 0.0 | Feature is `0` (zero, not null) |
| Source-gap record | Quality features flag it; signal values from the actual measurement are preserved if non-null |
| Insufficient history for a window | Rolling feature is computed with available data; `n_obs` shows count |
| Field has no canonical mapping | Feature is `null` |
| NaN produced by arithmetic | Sanitized to `null` before output |

**Invariant**: NaN never appears in feature output. All missing features are JSON `null`.

---

## Feature Families

### A. Quality Features

> File: [`ml/features/quality_features.py`](../ml/features/quality_features.py)

These describe the **telemetry health** of each record, not the physical process.

| Feature | Type | Formula / Definition | Safe for Real-Time? |
|---|---|---|---|
| `time_delta_seconds` | float / null | `timestamp[t] - timestamp[t-1]` in seconds. Null for first record. | Yes |
| `time_gap_flag` | int / null | `1` if `time_delta_seconds > 300`, else `0`. Null for first record. | Yes |
| `source_gap_flag` | int | `1` if `telemetry_status == "SOURCE_GAP"`, else `0` | Yes |
| `present_channel_count` | int | Count of canonical measurement channels with non-null value | Yes |
| `missing_channel_count` | int | Count of canonical measurement channels with null value | Yes |
| `telemetry_completeness` | float | `present_channel_count / total_channels` ∈ [0, 1] | Yes |

**Limitations**:  
- `time_gap_flag` threshold (300s) is heuristic; no physical basis established.  
- `telemetry_completeness` counts channels with non-null values, not channels with validated values.

---

### B. Signal Features

> File: [`ml/features/signal_features.py`](../ml/features/signal_features.py)

Computed for each of the 8 dynamic canonical channels:  
`rate_of_penetration`, `weight_on_bit`, `rotary_speed`, `torque`, `standpipe_pressure`, `flow_rate`, `hookload`, `block_position`

#### B1. Current Value

| Feature | Formula |
|---|---|
| `{field}.current_value` | Raw measurement value from canonical record. Null if missing. |

#### B2. Rolling Statistics (per window: short, medium, long)

| Feature | Formula | Notes |
|---|---|---|
| `{field}.roll_{window}_mean` | Time-windowed arithmetic mean of non-null values | |
| `{field}.roll_{window}_median` | Time-windowed median via `quantile(0.5)` | Faster than `apply(np.median)` |
| `{field}.roll_{window}_std` | Time-windowed standard deviation (ddof=1) | Null if n_obs < 2 |
| `{field}.roll_{window}_min` | Time-windowed minimum | |
| `{field}.roll_{window}_max` | Time-windowed maximum | |
| `{field}.roll_{window}_n_obs` | Count of non-null values in window | Use to assess window sparsity |

#### B3. Change Features

| Feature | Formula | Notes |
|---|---|---|
| `{field}.delta` | `value[t] - value[t-1]` where both are non-null | Null if either is null |
| `{field}.abs_delta` | `abs(delta)` | |
| `{field}.meaningful_change` | `1` if `abs_delta > tolerance`, else `0` | Null if delta is null |
| `{field}.meaningful_change_tolerance` | Documented tolerance value | From M0.2 MAD analysis |
| `{field}.roll_long_change_frequency` | `(changes > tol in long window) / n_obs_in_window` | |

**Meaningful Change Tolerances** (from M0.2 robust MAD analysis, WELL-1 specific):

| Channel | Tolerance | Method |
|---|---|---|
| `standpipe_pressure` | 7.05 | 0.05 × MAD (MAD = 141.0) |
| `hookload` | 0.0184 | 0.05 × MAD (MAD = 0.367) |
| `block_position` | 0.05 | 0.05 × MAD (MAD = 1.0) |
| All others | 0.0001 | Fallback (MAD = 0 in WELL-1 window) |

> **Limitation**: Tolerances were calibrated on the WELL-1 10,000-row window. They must be recalibrated for a different well or an extended dataset.  
> **Interpretation**: A `meaningful_change=1` is an OBSERVABLE SIGNAL (the value changed by more than the tolerance). It is NOT an anomaly label.

#### B4. Depth Features

`depth.current_value` is always `null`.  
No depth-derived features are computed.

> **Reason**: No verified continuously varying depth channel exists in WELL-1. `GS_DBTM` has 5 unique values and is largely static. `GS_DMEA`/`GS_DVER` are functionally constant. Standard depth channels are 100% missing.  
> **When available**: Once a validated depth channel is established, depth-derived features (e.g. rate of penetration per unit depth) can be added under a future feature version bump.

---

### C. State Features

> File: [`ml/features/state_features.py`](../ml/features/state_features.py)

Binary indicators of observable signal states. **No physical-event labels.**

| Feature | Value | Definition |
|---|---|---|
| `{field}_signal_present` | 0 / 1 | 1 if measurement value is non-null |
| `{field}_signal_missing` | 0 / 1 | 1 if measurement value is null |
| `{field}_signal_zero` | 0 / 1 | 1 if value == 0.0 (not null) |
| `{field}_source_gap` | 0 / 1 | 1 if measurement quality == SOURCE_GAP |
| `rotary_speed_is_zero` | 0 / 1 | 1 if rotary_speed value is 0.0 |
| `rotary_speed_is_nonzero` | 0 / 1 | 1 if rotary_speed value > 0 |
| `rotary_speed_available` | 0 / 1 | 1 if rotary_speed is non-null |
| `block_position_at_zero` | 0 / 1 | 1 if block_position == 0.0 |
| `block_position_positive` | 0 / 1 | 1 if block_position > 0 |
| `flow_rate_is_zero` | 0 / 1 | 1 if flow_rate == 0.0 |
| `flow_rate_is_nonzero` | 0 / 1 | 1 if flow_rate != 0.0 and non-null |
| `telemetry_partial` | 0 / 1 | 1 if telemetry_status == PARTIAL |
| `telemetry_gap` | 0 / 1 | 1 if telemetry_status == SOURCE_GAP |
| `telemetry_empty` | 0 / 1 | 1 if telemetry_status == EMPTY |

**What these are NOT**:  
- `rotary_speed_is_zero` does NOT mean "rig not drilling". RPM=0 is observable. Its physical cause is not established from WELL-1.  
- `block_position_at_zero` does NOT mean "bit on bottom". Physical interpretation requires verified depth.

---

### D. Relationship Features

> File: [`ml/features/relationship_features.py`](../ml/features/relationship_features.py)

Cross-channel arithmetic and rolling correlations. **Statistical associations only — not causal claims.**

| Feature | Formula | Inputs |
|---|---|---|
| `pressure_flow_ratio` | `standpipe_pressure / flow_rate` | Null if flow_rate ≈ 0 or either missing |
| `pressure_flow_abs_diff` | `abs(standpipe_pressure - flow_rate)` | Null if either missing |
| `hookload_bpos_diff` | `hookload - block_position` | Null if either missing |
| `torque_rpm_product` | `torque × rotary_speed` | Null if either missing |
| `torque_rpm_ratio` | `torque / rotary_speed` | Null if rpm ≈ 0 or either missing |
| `roll_medium_sppa_hkld_corr` | 300s Pearson correlation of SPPA vs HKLD | Null if < 3 observations |
| `roll_medium_bpos_hkld_corr` | 300s Pearson correlation of block_position vs hookload | |
| `roll_medium_torque_rpm_corr` | 300s Pearson correlation of torque vs rotary_speed | |
| `roll_medium_sppa_flow_corr` | 300s Pearson correlation of standpipe_pressure vs flow_rate | |

**Limitations**:  
- `pressure_flow_ratio` uses raw signal values, not calibrated physical units. The ratio has no confirmed physical meaning.  
- Pearson correlation is a linear association measure. Non-linear relationships are not captured.  
- All correlations require min 3 valid paired observations in the window.

---

## Recommended MVP Feature Set

A focused subset sufficient for telemetry health monitoring, change detection, and cross-channel context — without overengineering:

| Priority | Feature | Family | Rationale |
|---|---|---|---|
| 1 | `telemetry_completeness` | Quality | Core health indicator |
| 2 | `source_gap_flag` | Quality | Telemetry continuity signal |
| 3 | `time_delta_seconds` | Quality | Detects sparse/irregular intervals |
| 4 | `hookload.roll_medium_mean` | Signal | Most dynamic channel in WELL-1 |
| 5 | `hookload.meaningful_change` | Signal | Change detection |
| 6 | `standpipe_pressure.roll_short_std` | Signal | Short-term pressure variance |
| 7 | `standpipe_pressure.meaningful_change` | Signal | Change detection |
| 8 | `block_position.delta` | Signal | Block motion indicator |
| 9 | `rotary_speed_is_zero` | State | Simple state split |
| 10 | `flow_rate_is_zero` | State | Pump state observable |
| 11 | `hookload_bpos_diff` | Relationship | Block-hookload relationship |
| 12 | `roll_medium_sppa_hkld_corr` | Relationship | Cross-channel correlation context |

**Explicitly excluded from MVP**:
- Any depth-derived features (depth is null)  
- `rate_of_penetration.*` features (constant in WELL-1 window — zero information)  
- `weight_on_bit.*` features (constant zero — zero information)  
- Long-window correlations without sufficient history

---

## Files

| File | Purpose |
|---|---|
| [`ml/features/windows.py`](../ml/features/windows.py) | Window constants and channel definitions |
| [`ml/features/quality_features.py`](../ml/features/quality_features.py) | Telemetry health features |
| [`ml/features/signal_features.py`](../ml/features/signal_features.py) | Signal rolling stats and change features |
| [`ml/features/state_features.py`](../ml/features/state_features.py) | Observable state indicators |
| [`ml/features/relationship_features.py`](../ml/features/relationship_features.py) | Cross-channel relationships |
| [`ml/features/feature_engine.py`](../ml/features/feature_engine.py) | Orchestrator — batch vectorized processing |
| [`ml/features/validate_features.py`](../ml/features/validate_features.py) | Validation test suite (15 tests) |
| [`schemas/nwis_features.schema.json`](../schemas/nwis_features.schema.json) | Feature record JSON Schema |
| [`data/processed/well1_feature_sample.jsonl`](../data/processed/well1_feature_sample.jsonl) | Sample feature records from WELL-1 |
