# NWIS Intelligence Layer — v0.1.0

> **Status**: MVP/Prototype
> **Intelligence version**: `0.1.0`
> **Source**: [`ml/intelligence/`](../ml/intelligence/)
> **Schema**: [`schemas/nwis_intelligence.schema.json`](../schemas/nwis_intelligence.schema.json)

---

## Purpose

The Intelligence Layer sits on top of the NWIS Canonical Telemetry -> Feature Engine pipeline.
It is designed to detect **unusual drilling behaviour**, calculate an explainable risk/anomaly score, and produce structured intelligence.

**Critical Event Semantics Rule**:
This layer produces generic telemetry anomaly/risk intelligence. It describes signal behaviour. It does **NOT** make event-specific claims (e.g., "kick", "stuck pipe", "washout"). It preserves the distinction between anomalous behaviour and confirmed operational events.

---

## Architecture

The intelligence pipeline executes in a strict order per record to prevent data leakage (look-ahead).

```text
FEATURE RECORD (M0.4 output)
      ↓
QUALITY GATE (suppress EMPTY records)
      ↓
BASELINE (Causal rolling robust z-scores on past data [0..t-1])
      ↓
COMPONENT SCORES (Per-feature clipped deviations)
      ↓
BASELINE PUSH (Add record t to baseline history)
      ↓
RISK SCORING (Calculate overall score, apply quality caps, determine risk level)
      ↓
EVIDENCE EXTRACTION (Identify top contributing features)
      ↓
INTELLIGENCE RECORD
```

---

## 1. MVP Feature Set

The Intelligence Layer uses a targeted subset of 7 features from the M0.4 Feature Engine for scoring, plus additional features for the quality gate. 

**Features used for Anomaly Scoring (Weights sum to 1.0):**

| Feature Path | Weight | Rationale |
|---|---|---|
| `hookload.roll_medium_mean` | 0.22 | Most informative dynamic channel |
| `standpipe_pressure.roll_short_std` | 0.22 | Pressure volatility |
| `block_position.delta` | 0.14 | Block movement |
| `hookload.meaningful_change` | 0.13 | Direct change indicator |
| `hookload_bpos_diff` | 0.12 | Cross-channel structural feature |
| `standpipe_pressure.meaningful_change` | 0.11 | Pressure change indicator |
| `roll_medium_sppa_hkld_corr` | 0.06 | Correlation break |

**Features explicitly excluded from the weighted score:**
- `rotary_speed_is_zero` — constant (=1) in WELL-1; zero discriminating power
- `flow_rate_is_zero` — mostly zero in WELL-1; low discriminating power for anomaly scoring
- `time_delta_seconds` — used only for telemetry-quality/gap handling, not as a physical anomaly

---

## 2. Quality Gate

Before calculating risk, the quality gate ensures telemetry problems don't masquerade as physical anomalies:

1. **`EMPTY` Records**: Suppressed completely. No anomaly score is calculated (`intelligence_status: "SUPPRESSED"`).
2. **`SOURCE_GAP` Records**: Anomaly score is capped at `40.0` (`WATCH` level), and `source_gap_suppression` is set to `true`.
3. **Low Coverage**: If < 50% of the intelligence model features are available, the score is capped at `40.0`, and `low_coverage` is set to `true`.

Missing features are NOT converted to zero; they simply don't contribute to the score.

---

## 3. Baseline & Leakage Safeguards

The baseline is a **causal rolling robust z-score**: `(x - rolling_median) / (1.4826 * rolling_MAD)`.

- **Strict Past-Only Behaviour**: The baseline is computed using only data available *before* the current timestamp. The current observation never informs its own baseline. This is strictly enforced in the engine and validated in the tests.
- **Minimum Observations**: Requires at least 3 historical observations to compute a meaningful baseline.
- **Correlation Guard**: The rolling correlation feature (`roll_medium_sppa_hkld_corr`) is excluded unless both underlying signals have at least 10 observations and non-trivial variance in the window.

---

## 4. Anomaly Score & Risk Levels

The anomaly score is a linear weighted combination of per-feature deviation scores, normalized to `[0, 100]`. Missing features reduce the effective weight pool (the score is proportionally scaled up, not zero-filled).

**Prototype Thresholds:**

| Score | Risk Level |
|---|---|
| 0–30 | `NORMAL` |
| 30–60 | `WATCH` |
| 60–80 | `ELEVATED` |
| 80–100 | `HIGH` |

*Note: These are prototype parameters for the MVP, not validated engineering standards.*

---

## 5. Persistence & Debouncing

A single anomalous sample does not trigger an alert.
An `alert` becomes `true` only when the risk level has been:
- `>= WATCH` for `>= 3` consecutive records
- `>= ELEVATED` for `>= 2` consecutive records

This debouncing prevents sensor noise spikes from generating alerts.

---

## 6. Explainable Evidence

Every non-`NORMAL` intelligence result contains machine-readable evidence to explain *why* the score was generated.

It extracts up to 3 top contributing features, including:
- `feature`: The feature name (e.g., `hookload.roll_medium_mean`).
- `direction`: `HIGH` (positive z-score), `LOW` (negative z-score), or `ABNORMAL` (change indicator).
- `contribution`: The fraction of the total anomaly score from this feature (0–1).
- `z_score`: The robust z-score for interpretability.

---

## 7. Delivery & Validation

**Validation Suite:**
16 tests in [`ml/intelligence/validate_intelligence.py`](../ml/intelligence/validate_intelligence.py) verify the system, including strict checks against data leakage, handling of missing/zero values, quality gate operation, and debounce logic. All 16 tests pass.

**Outputs:**
- Schema: [`schemas/nwis_intelligence.schema.json`](../schemas/nwis_intelligence.schema.json)
- Sample Intelligence Records: [`data/processed/well1_intelligence_sample.jsonl`](../data/processed/well1_intelligence_sample.jsonl)
- Summary: [`data/metadata/well1_intelligence_summary.json`](../data/metadata/well1_intelligence_summary.json)
