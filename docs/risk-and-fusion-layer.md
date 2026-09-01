# Phase M0.8: Risk Modeling & Fusion Layer

## Overview

The NWIS architecture explicitly separates analytical intelligence from physical event labels. The Phase M0.8 Fusion Engine acts as the chronological synthesizer that combines disparate lines of evidence into a unified `[0, 100]` risk score and emits frontend-ready alerts.

### Architectural Tiers

1. **M0.4 Canonical Features:** Raw telemetry transformed into leak-free rolling physics markers.
2. **M0.5 Deterministic Intelligence:** Statistical process control (SPC) and heuristic physics constraints. Emits a foundational anomaly score.
3. **M0.6 Statistical ML:** Unsupervised baselines (Isolation Forest, K-Means) trained dynamically via a "warm-up -> fit -> inference" cycle.
4. **M0.7 Historical Knowledge:** Verified provenance tracing for physical events (e.g., STUCK_PIPE). WELL-1 currently possesses `0` verified events.
5. **M0.8 Fusion Engine:** Synthesizes M0.5, M0.6, and M0.7 into the final risk record.

## Fusion Methodology

The numerical risk score is synthesized purely from **analytical evidence** (M0.5 and M0.6). M0.7 acts strictly as contextual provenance.

### Prototype Weights
- **M0.5 Intelligence:** 0.45
- **M0.6 Machine Learning:** 0.55

If one component is missing (e.g., M0.6 model execution failed or was suppressed), the fusion engine explicitly renormalizes the remaining active weights so the risk score consistently spans the `[0, 100]` scale.

## The No-Hallucination Rule

M0.8 strictly enforces that analytical evidence (high anomaly scores) **cannot** unilaterally generate physical event terminology.
- M0.5/M0.6 can emit labels like `ELEVATED`, `HIGH`, or `STATISTICAL DEVIATION`.
- Event names like `STUCK_PIPE`, `WASHOUT`, or `KICK` are strictly locked behind the M0.7 Historical Knowledge layer. They may only be attached to the risk record if explicitly supplied by a `CONFIRMED` historical event intersecting the active timestamp.

## Prototype Supervised Learning (Random Forest)

Because WELL-1 lacks verified physical event labels, we cannot defensibly train a supervised predictive model on it.

To prepare the M0.8 architecture for future deployment, we implemented a supervised prototype (Random Forest). However, this prototype is strictly ring-fenced:
1. It is trained exclusively on injected, in-memory `SYNTHETIC_DEMO` fixtures.
2. It explicitly carries a `validation_status: NOT_REAL_WORLD_VALIDATED` flag.
3. It `used_in_risk_score` is hardcoded to `false`.

This guarantees that the architecture can support a supervised model when verified labeled data arrives, while completely preventing the fabrication of fake historical data to force an ML demo.

## Chronological Replay

The `replay_engine.py` orchestrates a strict chronological evaluation.
- It iterates timestamp by timestamp.
- It queries the M0.7 knowledge base for intersecting historical events (handling intervals, not just point-in-time exact matches).
- It explicitly prevents future context from leaking into the current inference window.
