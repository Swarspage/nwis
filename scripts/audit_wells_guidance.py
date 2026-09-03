"""
scripts/audit_wells_guidance.py

Audit script to verify guidance outputs across WELL-1 to WELL-6.
"""

from backend.data_service import data_service
from ml.guidance.engine import evaluate_guidance

def audit_wells():
    wells = ["WELL-1", "WELL-2", "WELL-3", "WELL-4", "WELL-5", "WELL-6"]
    print("=== NWIS Guidance Engine Audit ===")
    
    for well_id in wells:
        print(f"\n--- {well_id} ---")
        if well_id == "WELL-1":
            ds_risk = data_service.get_dataset(well_id, "risk")
            ts = ds_risk[-1]["timestamp"] if ds_risk else None
        else:
            ds_risk = data_service.get_dataset(well_id, "risk")
            ts = ds_risk[-1]["timestamp"] if ds_risk else None
            
        if not ts:
            print("No risk data found.")
            continue
            
        snap = {
            "well_id": well_id,
            "timestamp": ts,
            "risk": data_service.get_latest_before_or_at(data_service.get_dataset(well_id, "risk"), data_service.get_dataset_ts(well_id, "risk"), ts) or {},
            "intelligence": data_service.get_latest_before_or_at(data_service.get_dataset(well_id, "intelligence"), data_service.get_dataset_ts(well_id, "intelligence"), ts) or {},
            "telemetry": data_service.get_latest_before_or_at(data_service.get_dataset(well_id, "telemetry"), data_service.get_dataset_ts(well_id, "telemetry"), ts) or {},
            "models": data_service.get_models_at(well_id, ts)
        }
        
        guidance = evaluate_guidance(snap)
        g_dict = guidance.model_dump()
        print(f"Timestamp:        {g_dict['timestamp']}")
        print(f"Data Origin:      {g_dict['data_origin']}")
        print(f"Guidance Status:  {g_dict['guidance_status']}")
        print(f"Guidance Level:   {g_dict['guidance_level']}")
        print(f"Rule ID:          {g_dict['rule_id']}")
        print(f"Title:            {g_dict['title']}")
        print(f"Summary:          {g_dict['summary']}")
        print(f"Basis Count:      {len(g_dict['basis'])}")
        print(f"Action:           {g_dict['operational_action']}")
        print(f"Provenance:       {g_dict['provenance']['source']} ({g_dict['provenance']['validation_status']})")

if __name__ == "__main__":
    audit_wells()
