# NWIS ML Modeling Foundation (M0.6)

> **Status**: MVP/Prototype  
> **Source**: [`ml/models/`](../ml/models/)  
> **Output Schema**: [`schemas/nwis_model_output.schema.json`](../schemas/nwis_model_output.schema.json)  

---

## Purpose
The M0.6 Modeling Foundation establishes a clean, extensible, reproducible ML pipeline that runs *parallel* to the M0.5 deterministic intelligence layer. 

**Critical Design Constraints:**
- **No Ground Truth:** WELL-1 historical telemetry lacks verified operational labels (e.g. "kick", "stuck pipe"). Therefore, M0.6 focuses *exclusively* on **unsupervised/semi-supervised baseline models**.
- **No Look-Ahead:** Models strictly obey causality. A prediction at time `t` only uses information from time `< t`.
- **Missing != Zero:** Missing telemetry values are not treated as valid physical `0.0`s.
- **Explainability:** Models do not output black-box predictions; they return statistical deviations, neutral state descriptors, or distances, along with feature contributions.

---

## Architecture Pipeline

```text
       M0.4 FEATURE RECORD
               ↓
    DATASET ADAPTER & REGISTRY
       (Extract fixed schema)
               ↓
          PREPROCESSING
  (Impute missing, fit on warm-up)
               ↓
          MODEL ENGINE
               ├── AnomalyModel (Isolation Forest)
               ├── StateModel (K-Means Clustering)
               └── TemporalModel (Historical Deviation)
               ↓
      MODEL OUTPUT CONTRACT
```

### 1. Feature Registry & Adapter
Located in [`feature_registry.py`](../ml/models/feature_registry.py). It ensures a **fixed feature dimensionality**. We selectively exclude constant or zero-information features (like `rotary_speed`) to prevent model saturation.

### 2. Preprocessing
Located in [`preprocessing.py`](../ml/models/preprocessing.py).
- Numerical imputation uses the median of the **warm-up window** only.
- An explicit **missingness mask** is preserved and passed to models, ensuring they can differentiate between physical zeros and imputed NaNs.

---

## The Baseline Models

### 1. Anomaly Model (Isolation Forest)
- **Method:** `sklearn.ensemble.IsolationForest`
- **Purpose:** Identifies statistical outliers across the multi-dimensional feature space.
- **Output:** Outputs an `anomaly_score` normalized to `0-100`. High score = Highly anomalous isolation path.
- **Status:** Unsupervised. Does *not* assign event names.

### 2. Behavioral State Model (K-Means)
- **Method:** `sklearn.cluster.KMeans` (n=3 for MVP)
- **Purpose:** Clusters recurring feature patterns into neutral behavioral states.
- **Output:** Outputs neutral labels (e.g., `STATE_0`, `STATE_1`). 
- **Status:** Unsupervised. Does *not* map to standard operations like "drilling" or "tripping" without future verified labels.

### 3. Temporal Model (Rolling Distance)
- **Method:** Euclidean distance from recent historical median.
- **Purpose:** Detects abrupt temporal shifts in the signal, even if the absolute values remain within global "normal" bounds.
- **Output:** A distance metric from the short-term history. Returns `INSUFFICIENT_DATA` until sufficient rolling history is built.

---

## Leakage Policy & Warm-Up Phase

There is NO incremental online fit for `scikit-learn` Isolation Forest or K-Means in M0.6. We enforce a **chronological warm-up** lifecycle:
1. Engine extracts the first `N` records.
2. Preprocessor is fitted on `0..N`.
3. Models are fitted on preprocessed `0..N`.
4. The models and preprocessor are **frozen**.
5. Engine iterates sequentially over `N..end`, predicting on each record.

---

## Validation Suite
[`validate_models.py`](../ml/models/validate_models.py) contains 16 strict validation tests. 
Highlights:
- **Synthetic Perturbation:** Verifies that injecting an artificial mathematical spike into a clean sequence causes a proportional response in the anomaly score.
- **Coverage Penalties:** Verifies that missing features correctly reduce output confidence.
- **Provenance Safety:** Verifies `data_origin` is strictly preserved, and synthetic vs. historical structures are identical.
