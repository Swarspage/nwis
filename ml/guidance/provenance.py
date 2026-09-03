"""
ml/guidance/provenance.py

Provenance factories for the NWIS Engineering Guidance Engine.
Guarantees strict classification of rules and prevents false operational validation claims.
"""

from .schema import GuidanceProvenance, ProvenanceType, ValidationStatus


def build_heuristic_provenance(source: str = "NWIS_ANALYTICAL_HEURISTICS", doc_ref: str = None) -> GuidanceProvenance:
    return GuidanceProvenance(
        type=ProvenanceType.ENGINEERING_HEURISTIC,
        source=source,
        validation_status=ValidationStatus.NOT_OPERATIONALLY_VALIDATED,
        document_reference=doc_ref
    )


def build_analytical_provenance(source: str = "NWIS_M05_M06_FUSION") -> GuidanceProvenance:
    return GuidanceProvenance(
        type=ProvenanceType.ANALYTICAL_GUIDANCE,
        source=source,
        validation_status=ValidationStatus.NOT_OPERATIONALLY_VALIDATED,
        document_reference=None
    )


def build_limitation_provenance(reason: str = "DATA_UNAVAILABLE") -> GuidanceProvenance:
    return GuidanceProvenance(
        type=ProvenanceType.SYSTEM_LIMITATION,
        source=f"NWIS_QUALITY_GATE_{reason}",
        validation_status=ValidationStatus.NOT_OPERATIONALLY_VALIDATED,
        document_reference=None
    )
