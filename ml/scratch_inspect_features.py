import json
from pathlib import Path

sample = Path("../data/processed/well1_feature_sample.jsonl")
records = []
with open(sample) as f:
    for line in f:
        line = line.strip()
        if line:
            records.append(json.loads(line))

r = records[0]
print("=== TOP-LEVEL KEYS ===")
print(list(r.keys()))

print("\n=== QUALITY FEATURES ===")
print(json.dumps(r["quality_features"], indent=2))

print("\n=== STATE FEATURES (all) ===")
for k, v in r["state_features"].items():
    print(f"  {k}: {v}")

print("\n=== RELATIONSHIP FEATURES ===")
print(json.dumps(r["relationship_features"], indent=2))

print("\n=== SIGNAL hookload keys ===")
print(list(r["signal_features"]["hookload"].keys()))

print("\n=== PARTIAL record (index 1) ===")
r2 = records[1]
ts2 = r2["timestamp"]
status2 = r2["telemetry_status"]
print(f"ts={ts2}  status={status2}")
hkld2 = r2["signal_features"]["hookload"]
sppa2 = r2["signal_features"]["standpipe_pressure"]
bpos2 = r2["signal_features"]["block_position"]
rpm2  = r2["signal_features"]["rotary_speed"]
print(f"  hookload: current={hkld2['current_value']}  roll_medium_mean={hkld2['roll_medium_mean']}  meaningful_change={hkld2['meaningful_change']}")
print(f"  sppa:     current={sppa2['current_value']}  roll_short_std={sppa2['roll_short_std']}      meaningful_change={sppa2['meaningful_change']}")
print(f"  bpos:     delta={bpos2['delta']}")
print(f"  rpm:      current={rpm2['current_value']}")
print(f"  rel hookload_bpos_diff={r2['relationship_features']['hookload_bpos_diff']}")
print(f"  rel roll_medium_sppa_hkld_corr={r2['relationship_features']['roll_medium_sppa_hkld_corr']}")

print("\n=== GAP record ===")
gap = next(x for x in records if x["telemetry_status"] == "SOURCE_GAP")
print(f"ts={gap['timestamp']}  status={gap['telemetry_status']}")
print(f"  source_gap_flag={gap['quality_features']['source_gap_flag']}")
print(f"  telemetry_completeness={gap['quality_features']['telemetry_completeness']}")
print(f"  hookload current={gap['signal_features']['hookload']['current_value']}")
print(f"  bpos current={gap['signal_features']['block_position']['current_value']}")

print("\n=== Sample ranges across ALL records ===")
for field in ("hookload", "standpipe_pressure", "block_position"):
    vals = [x["signal_features"][field]["current_value"] for x in records if x["signal_features"][field]["current_value"] is not None]
    if vals:
        print(f"  {field}: min={min(vals):.3f}  max={max(vals):.3f}  n={len(vals)}")

print("\n=== State features across all records (sums) ===")
states_sum = {}
for x in records:
    for k, v in x["state_features"].items():
        if v is not None:
            states_sum[k] = states_sum.get(k, 0) + v
for k, v in sorted(states_sum.items(), key=lambda kv: -kv[1]):
    if v > 0:
        print(f"  {k}: {v}")
