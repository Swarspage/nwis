"""
ml/intelligence/risk_scorer.py

Risk level derivation and alert persistence/debouncing.

PROTOTYPE THRESHOLDS — not engineering standards:
    NORMAL    0–30
    WATCH    30–60
    ELEVATED 60–80
    HIGH     80–100

PERSISTENCE / DEBOUNCING:
    A single anomalous sample does not trigger an alert.
    Alert = True only when the risk level has been >= WATCH for >= DEBOUNCE_WATCH_RECORDS
    consecutive records, or >= ELEVATED for >= DEBOUNCE_ELEVATED_RECORDS.

    This prevents sensor noise spikes from generating alerts.
    Parameters are documented and configurable.

LANGUAGE POLICY:
    Risk levels are NORMAL / WATCH / ELEVATED / HIGH.
    They represent statistical anomaly severity.
    They do NOT imply confirmed drilling events.
"""

from dataclasses import dataclass, field
from typing import Optional

# Prototype thresholds — document any changes with rationale
RISK_THRESHOLDS = [
    (80.0, "HIGH"),
    (60.0, "ELEVATED"),
    (30.0, "WATCH"),
    (0.0,  "NORMAL"),
]

# Debounce windows — consecutive records required before alert fires
DEBOUNCE_WATCH_RECORDS    = 3
DEBOUNCE_ELEVATED_RECORDS = 2

# Caps applied by quality gate before risk level determination
SOURCE_GAP_SCORE_CAP  = 40.0
LOW_COVERAGE_SCORE_CAP = 40.0


def score_to_level(score: float) -> str:
    """Map anomaly score [0, 100] to risk level string."""
    for threshold, level in RISK_THRESHOLDS:
        if score >= threshold:
            return level
    return "NORMAL"


@dataclass
class PersistenceState:
    """
    Tracks consecutive records at each risk level for debouncing.
    One instance per well / stream.
    """
    consecutive_watch_plus:    int = 0
    consecutive_elevated_plus: int = 0
    alert_active:              bool = False

    def update(self, risk_level: str) -> bool:
        """
        Update persistence state and return whether an alert should be fired.

        Parameters
        ----------
        risk_level : str — one of NORMAL / WATCH / ELEVATED / HIGH

        Returns
        -------
        bool — True if alert should be set to True for this record
        """
        if risk_level in ("WATCH", "ELEVATED", "HIGH"):
            self.consecutive_watch_plus += 1
        else:
            self.consecutive_watch_plus = 0
            self.alert_active = False

        if risk_level in ("ELEVATED", "HIGH"):
            self.consecutive_elevated_plus += 1
        else:
            self.consecutive_elevated_plus = 0

        # Alert fires when debounce threshold is met
        if self.consecutive_elevated_plus >= DEBOUNCE_ELEVATED_RECORDS:
            self.alert_active = True
        elif self.consecutive_watch_plus >= DEBOUNCE_WATCH_RECORDS:
            self.alert_active = True
        # Alert stays True once active until risk drops to NORMAL
        return self.alert_active


def apply_quality_caps(
    raw_score: float,
    source_gap: bool,
    low_coverage: bool,
) -> tuple[float, bool, bool]:
    """
    Apply quality-gate caps to the raw anomaly score.

    Returns (capped_score, gap_capped, coverage_capped).
    A quality problem must not automatically become a drilling-risk alert.
    """
    score = raw_score
    gap_capped = False
    coverage_capped = False

    if source_gap and score > SOURCE_GAP_SCORE_CAP:
        score = SOURCE_GAP_SCORE_CAP
        gap_capped = True

    if low_coverage and score > LOW_COVERAGE_SCORE_CAP:
        score = LOW_COVERAGE_SCORE_CAP
        coverage_capped = True

    return score, gap_capped, coverage_capped


def compute_confidence(
    available_count: int,
    total_scoreable: int,
    source_gap: bool,
    insufficient_baseline: bool,
) -> float:
    """
    Compute confidence score [0, 1].

    Reflects:
    - Feature coverage (what fraction of model features were available)
    - Source gap penalty
    - Insufficient baseline penalty
    """
    if total_scoreable == 0:
        return 0.0

    coverage = available_count / total_scoreable
    if source_gap:
        coverage *= 0.7  # 30% gap penalty
    if insufficient_baseline:
        coverage *= 0.8  # 20% early-record penalty

    return round(min(max(coverage, 0.0), 1.0), 4)
