import os

class Config:
    API_VERSION = "1.0.0"
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:3000,http://localhost:8080,http://localhost:5173").split(",")
    
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
    METADATA_DIR = os.path.join(DATA_DIR, "metadata")
    
    # Existing Artifact Paths for WELL-1
    WELL1_TELEMETRY = os.path.join(PROCESSED_DIR, "well1_feature_sample.jsonl")
    WELL1_INTELLIGENCE = os.path.join(PROCESSED_DIR, "well1_intelligence_sample.jsonl")
    WELL1_MODELS = os.path.join(PROCESSED_DIR, "well1_model_sample.jsonl")
    WELL1_HISTORICAL = os.path.join(PROCESSED_DIR, "well1_historical_events.jsonl")
    WELL1_KNOWLEDGE = os.path.join(PROCESSED_DIR, "well1_knowledge_sample.jsonl")
    WELL1_RISK = os.path.join(PROCESSED_DIR, "well1_risk_sample.jsonl")
    
    WELL1_RISK_SUMMARY = os.path.join(METADATA_DIR, "well1_risk_summary.json")

config = Config()
