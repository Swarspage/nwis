import os
import json
import pandas as pd
import numpy as np
from pathlib import Path

def main():
    repo_root = Path(__file__).resolve().parent.parent.parent
    data_path = repo_root / "data" / "raw" / "WELL-1.csv"
    metadata_dir = repo_root / "data" / "metadata"
    
    metadata_dir.mkdir(parents=True, exist_ok=True)
    
    file_size = os.path.getsize(data_path)
    
    # Check for duplicate columns manually first (pandas mangles them by default)
    with open(data_path, 'r', encoding='utf-8') as f:
        header = f.readline().strip().split(',')
    
    col_counts = pd.Series(header).value_counts()
    duplicate_cols = col_counts[col_counts > 1].index.tolist()

    df = pd.read_csv(data_path)
    
    audit_results = {
        "provenance": {
            "source": "VLOVE",
            "dataset": "WELL-1",
            "provenance_note": "This dataset is an external VLOVE drilling telemetry dataset used as a prototype/development data source. It must not be represented as OIL operational data."
        },
        "file_structure": {
            "file_size_bytes": file_size,
            "num_rows": len(df),
            "num_columns": len(header), # original header len
            "exact_column_names": header,
            "duplicate_column_names": duplicate_cols
        },
        "data_types": {},
        "time": {},
        "depth": {},
        "core_channels": {},
        "data_quality_flags": {}
    }
    
    # 2. Data Types
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    non_numeric_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    
    # Let's try to convert any non-numeric to datetime if possible, or just check 'TIME'
    datetime_cols = []
    identifier_cols = []
    
    for col in non_numeric_cols:
        if 'time' in col.lower() or col == 'TIME':
            datetime_cols.append(col)
        elif df[col].nunique() < len(df) * 0.05 and df[col].dtype == 'object':
             if 'name' in col.lower() or 'id' in col.lower():
                 identifier_cols.append(col)

    audit_results['data_types'] = {
        "column_dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "numeric_columns": numeric_cols,
        "non_numeric_columns": non_numeric_cols,
        "datetime_like_columns": datetime_cols,
        "likely_identifier_columns": identifier_cols
    }
    
    # 3. Time
    time_col = None
    if 'TIME' in df.columns:
        time_col = 'TIME'
    elif len(datetime_cols) > 0:
        time_col = datetime_cols[0]
        
    if time_col:
        try:
            df[time_col] = pd.to_datetime(df[time_col])
            t_min = df[time_col].min()
            t_max = df[time_col].max()
            t_unique = df[time_col].nunique()
            t_dupes = len(df) - t_unique
            t_sorted = df[time_col].is_monotonic_increasing
            
            diffs = df[time_col].diff().dropna()
            diff_secs = diffs.dt.total_seconds()
            
            t_gap_max = diff_secs.max() if len(diff_secs) > 0 else 0
            t_interval_approx = diff_secs.median() if len(diff_secs) > 0 else 0
            
            audit_results['time'] = {
                "timestamp_column": time_col,
                "min_timestamp": str(t_min),
                "max_timestamp": str(t_max),
                "num_unique_timestamps": t_unique,
                "duplicate_timestamps": t_dupes,
                "chronological_ordering": bool(t_sorted),
                "max_time_gap_seconds": float(t_gap_max),
                "approx_sampling_interval_seconds": float(t_interval_approx)
            }
        except Exception as e:
            audit_results['time'] = {"error": str(e)}

    # 4. Depth
    depth_candidates = [c for c in df.columns if any(kd in c.upper() for kd in ['DEPT', 'DBTM', 'DMEA', 'DVER', 'DEPTH'])]
    for dc in depth_candidates:
        if dc in numeric_cols:
            s = df[dc]
            valid = s.dropna()
            reversals = 0
            if len(valid) > 1:
                # simple proxy: times it decreases
                reversals = int((valid.diff() < 0).sum())
            audit_results['depth'][dc] = {
                "min": float(s.min()) if not pd.isna(s.min()) else None,
                "max": float(s.max()) if not pd.isna(s.max()) else None,
                "median": float(s.median()) if not pd.isna(s.median()) else None,
                "missingness_percent": float(s.isna().mean() * 100),
                "monotonicity": bool(valid.is_monotonic_increasing),
                "reversals": reversals,
                "repeated_values": int(len(s) - s.nunique() - s.isna().sum()),
                "obvious_invalid_negative": int((s < 0).sum())
            }

    # 5. Core Channels
    core_channels = ['GS_ROP', 'GS_SWOB', 'GS_RPM', 'GS_TQA', 'GS_SPPA', 'GS_TFLO', 'GS_HKLD', 'GS_BPOS', 'GS_DMEA', 'GS_DVER']
    for cc in core_channels:
        if cc in df.columns:
            s = df[cc]
            if pd.api.types.is_numeric_dtype(s):
                audit_results['core_channels'][cc] = {
                    "dtype": str(s.dtype),
                    "non_null_count": int(s.count()),
                    "missing_percent": float(s.isna().mean() * 100),
                    "unique_count": int(s.nunique()),
                    "min": float(s.min()) if not pd.isna(s.min()) else None,
                    "max": float(s.max()) if not pd.isna(s.max()) else None,
                    "mean": float(s.mean()) if not pd.isna(s.mean()) else None,
                    "median": float(s.median()) if not pd.isna(s.median()) else None,
                    "std": float(s.std()) if not pd.isna(s.std()) else None,
                    "p01": float(s.quantile(0.01)) if not pd.isna(s.quantile(0.01)) else None,
                    "p99": float(s.quantile(0.99)) if not pd.isna(s.quantile(0.99)) else None,
                    "zeros": int((s == 0).sum()),
                    "negatives": int((s < 0).sum()),
                    "nan_inf": int(s.isna().sum() + np.isinf(s).sum())
                }
            else:
                audit_results['core_channels'][cc] = {"dtype": str(s.dtype), "note": "Not numeric"}

    # 6. All Numeric Channels Table
    summary_list = []
    for col in numeric_cols:
        s = df[col]
        summary_list.append({
            "name": col,
            "dtype": str(s.dtype),
            "non_null_percent": float(s.count() / len(df) * 100),
            "unique_count": int(s.nunique()),
            "min": s.min(),
            "max": s.max(),
            "mean": s.mean(),
            "std": s.std(),
            "zero_percent": float((s == 0).sum() / len(df) * 100),
            "negative_percent": float((s < 0).sum() / len(df) * 100)
        })
    df_summary = pd.DataFrame(summary_list).sort_values('non_null_percent', ascending=False)
    df_summary.to_csv(metadata_dir / 'well1_channel_summary.csv', index=False)

    # 7. Constant / Low-info
    constants = []
    nearly_constants = []
    high_missing = []
    for col in df.columns:
        s = df[col]
        n_unique = s.nunique()
        na_pct = s.isna().mean()
        
        if na_pct > 0.9:
            high_missing.append(col)
        
        if n_unique <= 1:
            constants.append(col)
        elif n_unique > 0:
            top_val_pct = s.value_counts(normalize=True, dropna=True).iloc[0] if len(s.dropna()) > 0 else 0
            if top_val_pct > 0.99:
                nearly_constants.append(col)

    audit_results['low_info_channels'] = {
        "constant_columns": constants,
        "nearly_constant_columns": nearly_constants,
        "high_missingness_columns": high_missing
    }

    # 8. Correlation
    df_num = df[numeric_cols]
    corr_matrix = df_num.corr()
    corr_matrix.to_csv(metadata_dir / 'well1_correlation.csv')
    
    # Extract strongest correlations
    corr_unstacked = corr_matrix.abs().unstack()
    corr_unstacked = corr_unstacked[corr_unstacked < 1.0].dropna()
    strongest_corr = corr_unstacked.sort_values(ascending=False).drop_duplicates().head(20)
    audit_results['strongest_correlations'] = {
        f"{idx[0]}_vs_{idx[1]}": float(val) for idx, val in strongest_corr.items()
    }

    # 9. Operational Activity Proxy
    # Basic proxy based on observable physical channels if present
    activity_proxy = "Could not determine operational activity proxy due to missing key channels."
    if 'GS_RPM' in df.columns and 'GS_SPPA' in df.columns:
        # e.g., RPM > 10 OR SPPA > 100 (psi/bar roughly) indicates some rig activity
        active_mask = (df['GS_RPM'].fillna(0) > 10) | (df['GS_SPPA'].fillna(0) > 100)
        pct_active = active_mask.mean() * 100
        activity_proxy = f"Based on GS_RPM > 10 OR GS_SPPA > 100, approx {pct_active:.1f}% of records appear operationally active."
    
    audit_results['operational_activity_proxy'] = activity_proxy

    # 10. Data Quality Flags
    audit_results['data_quality_flags'] = {
        "total_missing_values": int(df.isna().sum().sum()),
        "columns_with_missing_values": int((df.isna().sum() > 0).sum()),
        "duplicate_timestamps": audit_results['time'].get('duplicate_timestamps', 0),
        "suspicious_time_gaps": bool(audit_results['time'].get('max_time_gap_seconds', 0) > 3600) # e.g. >1 hour
    }

    with open(metadata_dir / 'well1_audit.json', 'w') as f:
        json.dump(audit_results, f, indent=2)

    # 11. Terminal Output
    print("NWIS WELL-1 DATA AUDIT")
    print("======================")
    print(f"Source: {audit_results['provenance']['source']}")
    print(f"Rows: {audit_results['file_structure']['num_rows']}")
    print(f"Columns: {audit_results['file_structure']['num_columns']}")
    print(f"Time range: {audit_results['time'].get('min_timestamp')} to {audit_results['time'].get('max_timestamp')}")
    print(f"Timestamp column: {audit_results['time'].get('timestamp_column')}")
    print(f"Depth column(s): {', '.join(list(audit_results['depth'].keys()))}")
    print("\nCore channels:")
    for cc in core_channels:
        status = "[Y]" if cc in df.columns else "[N]"
        print(f"{status} {cc}")
    
    print("\nData quality:")
    print(f"Missingness: {audit_results['data_quality_flags']['total_missing_values']} total missing values")
    print(f"Duplicate timestamps: {audit_results['data_quality_flags']['duplicate_timestamps']}")
    print(f"Time gaps (max): {audit_results['time'].get('max_time_gap_seconds', 0)} seconds")
    
    status_str = "READY" if audit_results['data_quality_flags']['duplicate_timestamps'] == 0 else "NEEDS INVESTIGATION"
    print(f"\nStatus:\n{status_str}")

if __name__ == "__main__":
    main()
