import json
from typing import List, Dict, Any, Iterable

from .dataset_adapter import adapt_record, ModelReadyRecord
from .preprocessing import Preprocessor
from .model_registry import get_model_registry

def process_feature_records(records: Iterable[Dict[str, Any]], warmup_size: int = 15) -> Iterable[List[Dict[str, Any]]]:
    """
    Orchestrates the M0.6 ML Modeling pipeline.
    Yields a list of model outputs for each input record (1 list of outputs per record).
    """
    records_list = list(records)
    if not records_list:
        return []

    # 1. Adapt records
    adapted_records = [adapt_record(r) for r in records_list]
    
    # 2. Extract warm-up data
    actual_warmup_size = min(warmup_size, len(adapted_records))
    warmup_records = adapted_records[:actual_warmup_size]
    
    # Initialize models & preprocessor
    models = get_model_registry()
    preprocessor = Preprocessor()
    
    can_fit = actual_warmup_size >= 3 # Minimal safety check for clustering/IF
    
    if can_fit:
        # 3. Fit preprocessing on warm-up data
        preprocessor.fit(warmup_records)
        
        # 4. Transform warm-up data for fitting models
        X_train = []
        for r in warmup_records:
            imputed_features, _ = preprocessor.transform(r)
            X_train.append(imputed_features)
            
        # 5. Fit models
        for name, model in models.items():
            try:
                model.fit(X_train)
            except Exception as e:
                # If a model fails to fit, it remains is_fitted = False
                # and predict() will gracefully return UNAVAILABLE
                pass
                
    # 6. Predict on all records (including warm-up, so output aligns 1:1 with input)
    # The models will score the warm-up records based on the frozen model.
    # Note: Temporal model updates state dynamically during predict, so we must iterate chronologically.
    
    for record in adapted_records:
        record_outputs = []
        
        # Preprocess
        if preprocessor.is_fitted:
            X_imputed, _ = preprocessor.transform(record)
        else:
            # If not fitted, we can't properly evaluate. 
            # We pass dummy data to let models return UNAVAILABLE.
            X_imputed = [0.0] * len(preprocessor.feature_names)
            
        # Run each model independently (Failure Isolation)
        for name, model in models.items():
            try:
                out = model.predict(record, X_imputed)
                record_outputs.append(out)
            except Exception as e:
                # Graceful degradation if a model fails during inference
                record_outputs.append({
                    "model_name": name,
                    "model_version": getattr(model, "model_version", "unknown"),
                    "timestamp": record.timestamp,
                    "well_id": record.well_id,
                    "data_origin": record.data_origin,
                    "status": "ERROR",
                    "score": None,
                    "label": None,
                    "confidence": None,
                    "feature_coverage": None,
                    "evidence": None,
                    "source_row_index": record.source_row_index
                })
                
        yield record_outputs

def process_jsonl_file(input_path: str, output_path: str, summary_path: str, warmup_size: int = 15):
    """
    Reads a JSONL file of M0.4 feature records, runs the ML engine,
    and writes the model outputs to a new JSONL file.
    """
    records = []
    with open(input_path, 'r') as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
                
    outputs = list(process_feature_records(records, warmup_size))
    
    # Write outputs
    flat_outputs = []
    with open(output_path, 'w') as f:
        for record_outs in outputs:
            for out in record_outs:
                flat_outputs.append(out)
                f.write(json.dumps(out) + "\n")
                
    # Generate simple summary
    summary = {
        "well_id": records[0]["well_id"] if records else "UNKNOWN",
        "total_input_records": len(records),
        "total_model_outputs": len(flat_outputs),
        "models_run": list(get_model_registry().keys()),
        "status_counts": {}
    }
    
    for out in flat_outputs:
        st = out["status"]
        summary["status_counts"][st] = summary["status_counts"].get(st, 0) + 1
        
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
