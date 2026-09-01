import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json

def analyze_runs(series, time_series):
    """
    Analyzes runs of constant valid values, explicitly breaking runs on NaNs.
    """
    constant_runs_rows = []
    constant_runs_secs = []
    
    current_val = None
    run_len = 0
    run_start_time = None
    run_last_time = None
    
    exact_change_count = 0
    
    for i in range(len(series)):
        val = series.iloc[i]
        t = time_series.iloc[i]
        
        if pd.isna(val):
            if run_len > 0:
                constant_runs_rows.append(run_len)
                constant_runs_secs.append((run_last_time - run_start_time).total_seconds())
            run_len = 0
            current_val = None
            continue
            
        if current_val is None or val != current_val:
            if run_len > 0:
                constant_runs_rows.append(run_len)
                constant_runs_secs.append((run_last_time - run_start_time).total_seconds())
                # Exact change only if current_val was not None (not the first valid after NaN)
                # Wait, value[t] != value[t-1] means we just look at adjacent rows
            
            current_val = val
            run_len = 1
            run_start_time = t
            run_last_time = t
        else:
            run_len += 1
            run_last_time = t
            
    if run_len > 0:
        constant_runs_rows.append(run_len)
        constant_runs_secs.append((run_last_time - run_start_time).total_seconds())
        
    num_valid = series.notna().sum()
    unchanged_consecutive = sum(r - 1 for r in constant_runs_rows if r > 1)
    
    # Exact changes: adjacent rows both valid and not equal
    # Shift by 1 to compare adjacent
    s_valid_adj = series.notna() & series.shift(1).notna()
    exact_changes = (series[s_valid_adj] != series.shift(1)[s_valid_adj]).sum()
    
    # Assertions
    assert exact_changes <= num_valid, "exact_change_count cannot exceed valid transitions"
    max_run = max(constant_runs_rows) if constant_runs_rows else 0
    assert max_run <= num_valid, "longest constant run cannot be greater than number of valid observations"
    med_run = np.median(constant_runs_rows) if constant_runs_rows else 0
    assert med_run <= max_run, "median constant run cannot exceed longest constant run"
    
    return {
        "valid_obs": int(num_valid),
        "exact_changes": int(exact_changes),
        "unchanged_consecutive": int(unchanged_consecutive),
        "median_run_rows": float(med_run),
        "longest_run_rows": int(max_run),
        "median_run_secs": float(np.median(constant_runs_secs) if constant_runs_secs else 0),
        "longest_run_secs": float(max(constant_runs_secs) if constant_runs_secs else 0)
    }

def robust_mad(series):
    med = series.median()
    return np.median(np.abs(series - med))

def main():
    repo_root = Path(__file__).resolve().parent.parent.parent
    data_path = repo_root / "data" / "raw" / "WELL-1.csv"
    metadata_dir = repo_root / "data" / "metadata"
    plots_dir = metadata_dir / "plots"
    
    metadata_dir.mkdir(parents=True, exist_ok=True)
    plots_dir.mkdir(parents=True, exist_ok=True)
    
    print("Loading dataset...")
    df = pd.read_csv(data_path)
    df['TIME'] = pd.to_datetime(df['TIME'])
    
    # Assert timestamp ordering
    assert df['TIME'].is_monotonic_increasing, "timestamp ordering remains valid"
    assert (df['TIME'].diff() == pd.Timedelta(seconds=0)).sum() == 0, "duplicate timestamps remain zero"
    
    core_channels = ['GS_ROP', 'GS_SWOB', 'GS_RPM', 'GS_TQA', 'GS_SPPA', 'GS_TFLO', 'GS_HKLD', 'GS_BPOS', 'GS_DBTM', 'GS_DMEA', 'GS_DVER']
    core_channels = [c for c in core_channels if c in df.columns]
    
    print("\n--- TASK 2, 3, 4: REIMPLEMENT RUN ANALYSIS & EXTREME VALUES ---")
    metrics_data = []
    diagnostics = {}
    
    for col in core_channels:
        s = df[col]
        cov_pct = s.notna().mean() * 100
        assert 0 <= cov_pct <= 100, "all reported percentages are between 0 and 100"
        
        runs_info = analyze_runs(s, df['TIME'])
        
        # Meaningful change
        mad = robust_mad(s.dropna())
        tolerance = 0.05 * mad if mad > 0 else 1e-4
        
        s_valid_adj = s.notna() & s.shift(1).notna()
        abs_diff = (s[s_valid_adj] - s.shift(1)[s_valid_adj]).abs()
        meaningful_changes = (abs_diff > tolerance).sum()
        
        # Extreme values
        med = s.median()
        p01 = s.quantile(0.01)
        p99 = s.quantile(0.99)
        
        # Robust outlier threshold: median +/- 5 * MAD
        # For a normal distribution, 3 * 1.4826 * MAD is ~3 std dev. 5 * MAD is ~3.3 std dev.
        outlier_thresh = 5 * mad
        outlier_count = ((s > med + outlier_thresh) | (s < med - outlier_thresh)).sum() if mad > 0 else 0
        
        zero_pct = (s == 0).mean() * 100
        neg_pct = (s < 0).mean() * 100
        
        notes = f"MAD={mad:.4f}, Tol={tolerance:.4f}."
        if s.nunique() <= 1:
            notes += " Functionally constant."
            
        metrics_data.append({
            "channel": col,
            "coverage_pct": cov_pct,
            "unique_count": s.nunique(),
            "exact_change_count": runs_info['exact_changes'],
            "exact_change_pct": runs_info['exact_changes'] / runs_info['valid_obs'] * 100 if runs_info['valid_obs'] > 0 else 0,
            "meaningful_change_count": meaningful_changes,
            "median_constant_run_rows": runs_info['median_run_rows'],
            "longest_constant_run_rows": runs_info['longest_run_rows'],
            "median_constant_run_seconds": runs_info['median_run_secs'],
            "longest_constant_run_seconds": runs_info['longest_run_secs'],
            "median": med,
            "p01": p01,
            "p99": p99,
            "zero_pct": zero_pct,
            "negative_pct": neg_pct,
            "outlier_count": outlier_count,
            "notes": notes
        })
        
        diagnostics[col] = {
            "min": s.min(),
            "max": s.max(),
            "median": med,
            "mad": mad,
            "outlier_count": int(outlier_count),
            "meaningful_change_tolerance": tolerance
        }
        
    metrics_df = pd.DataFrame(metrics_data)
    metrics_df.to_csv(metadata_dir / 'well1_core_channel_metrics.csv', index=False)
    
    with open(metadata_dir / 'well1_core_diagnostics.json', 'w') as f:
        # Convert types safely
        clean_diag = {}
        for k, v in diagnostics.items():
            clean_diag[k] = {ik: (float(iv) if pd.notna(iv) else None) if isinstance(iv, (np.floating, float)) else iv for ik, iv in v.items()}
        json.dump(clean_diag, f, indent=2)
        
    print(f"Generated metrics for {len(core_channels)} channels.")

    print("\n--- TASK 5: TIME GAP ---")
    diffs = df['TIME'].diff()
    max_idx = diffs.idxmax()
    gap_seconds = diffs[max_idx].total_seconds()
    
    print(f"Largest gap: {gap_seconds} seconds")
    print(f"Before: {df['TIME'].iloc[max_idx - 1]}")
    print(f"After:  {df['TIME'].iloc[max_idx]}")
    
    print("\nChannels across gap:")
    for col in core_channels:
        val_before = df[col].iloc[max_idx - 1]
        val_after = df[col].iloc[max_idx]
        
        if pd.isna(val_before) and pd.isna(val_after):
            state = "remains NaN"
        elif pd.notna(val_before) and pd.isna(val_after):
            state = "becomes NaN (consistent with a telemetry/data continuity issue)"
        elif pd.isna(val_before) and pd.notna(val_after):
            state = "becomes valid"
        else:
            if val_before == val_after:
                state = "continues normally (identical value)"
            else:
                state = "changes state/value"
                
        print(f"{col:10} | Before: {val_before:<10} | After: {val_after:<10} | {state}")


    print("\n--- TASK 6: DEPTH & MOTION INVESTIGATION ---")
    depth_candidates = ['GS_DBTM', 'GS_DMEA', 'GS_DVER', 'GS_DRTM', 'GS_TDH', 'DBTM', 'DMEA', 'DEPT', 'SRVDEPTH']
    motion_candidates = ['GS_BPOS', 'BPOS', 'BVEL', 'GS_ROP', 'ROP', 'ROP5', 'ROP30s', 'QROP', 'GS_SWOB', 'SWOB', 'SWOB30s', 'GS_RPM', 'RPM', 'RPM30s', 'GS_HKLD', 'HKLD', 'HKLD30s']
    
    all_cands = [c for c in depth_candidates + motion_candidates if c in df.columns]
    
    for dc in all_cands:
        s = df[dc]
        cov = s.notna().mean() * 100
        n_uniq = s.nunique()
        changes = (s.dropna().diff() != 0).sum() if len(s.dropna()) > 0 else 0
        med = s.median()
        runs_info = analyze_runs(s, df['TIME']) if cov > 0 else {}
        med_sec = runs_info.get("median_run_secs", 0)
        
        print(f"{dc:10} | Cov: {cov:5.1f}% | Uniq: {n_uniq:5} | Changes: {changes:5} | MedRunSecs: {med_sec:7.1f} | Min: {s.min()} | Max: {s.max()} | Med: {med}")

if __name__ == "__main__":
    main()
