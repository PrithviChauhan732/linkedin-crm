import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from model import IntentClassifierModel

app = FastAPI(
    title="WarmDM ML Intent Classification Service",
    description="Sub-10ms NLP message classification microservice",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = IntentClassifierModel()

@app.on_event("startup")
def startup_event():
    count = classifier.train()
    print(f"Loaded and trained ML model on {count} samples.")

class PredictRequest(BaseModel):
    text: str

class TrainSample(BaseModel):
    text: str
    label: str

class TrainRequest(BaseModel):
    samples: List[TrainSample]

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "WarmDM ML Classifier",
        "model_trained": classifier.is_trained
    }

@app.post("/predict")
def predict_intent(req: PredictRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    start_time = time.time()
    res = classifier.predict(req.text)
    latency_ms = round((time.time() - start_time) * 1000, 2)
    
    res["latency_ms"] = latency_ms
    return res

@app.post("/train")
def train_model(req: TrainRequest):
    samples_tuple = [(s.text, s.label) for s in req.samples]
    total = classifier.train(extra_data=samples_tuple)
    return {"ok": True, "total_samples": total}

@app.post("/explain")
def explain_prediction(req: PredictRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    return classifier.explain(req.text)
