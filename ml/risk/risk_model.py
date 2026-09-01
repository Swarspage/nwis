import numpy as np
from sklearn.ensemble import RandomForestClassifier

class PrototypeRiskModel:
    """
    Isolated supervised RandomForestClassifier prototype to validate the future 
    supervised-learning interface. Trained exclusively on SYNTHETIC_DEMO fixtures.
    Must not contribute to the production WELL-1 risk score.
    """
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=10, random_state=42)
        self.is_fitted = False
        
    def fit_synthetic(self, X: np.ndarray, y: np.ndarray):
        """Fits the prototype strictly on synthetic data."""
        self.model.fit(X, y)
        self.is_fitted = True
        
    def predict_prototype(self, features: dict) -> dict:
        """
        Returns the prediction in the isolated prototype format.
        """
        if not self.is_fitted:
            return {
                "available": False,
                "data_origin": "UNAVAILABLE",
                "used_in_risk_score": False
            }
            
        # Simplified feature extraction for prototype (assuming features dict has specific keys)
        # In a real model, this would be a rigorous feature pipeline.
        x_val = features.get("hookload.roll_medium_mean", 0.0)
        X_test = np.array([[x_val]])
        
        try:
            pred = self.model.predict(X_test)[0]
            prob = self.model.predict_proba(X_test)[0].max()
            
            return {
                "available": True,
                "data_origin": "SYNTHETIC_DEMO",
                "used_in_risk_score": False,
                "validation_status": "NOT_REAL_WORLD_VALIDATED",
                "prediction": "EVENT" if pred == 1 else "NORMAL",
                "probability": float(prob)
            }
        except Exception:
            return {
                "available": False,
                "data_origin": "UNAVAILABLE",
                "used_in_risk_score": False
            }

def train_prototype() -> PrototypeRiskModel:
    """Creates and trains the isolated synthetic prototype model."""
    rm = PrototypeRiskModel()
    
    # Generate SYNTHETIC_DEMO data
    X_synth = np.array([[10.0], [20.0], [100.0], [150.0]])
    y_synth = np.array([0, 0, 1, 1])
    
    rm.fit_synthetic(X_synth, y_synth)
    return rm
