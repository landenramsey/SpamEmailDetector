from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.spam_detector import SpamDetector
import uvicorn

app = FastAPI(title="Email Spam Detector API")

# Enable CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your extension's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector once at startup
detector = None

@app.on_event("startup")
async def startup_event():
    global detector
    print("Loading spam detection model...")
    detector = SpamDetector()
    print("API ready!")

class EmailRequest(BaseModel):
    text: str

class SpamResponse(BaseModel):
    is_spam: bool
    confidence: float
    message: str

@app.get("/")
async def root():
    return {"message": "Email Spam Detector API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": detector is not None}

@app.post("/predict", response_model=SpamResponse)
async def predict_spam(email: EmailRequest):
    """
    Predict if an email is spam
    
    Args:
        email: EmailRequest with text field containing email content
    
    Returns:
        SpamResponse with is_spam, confidence, and message
    """
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if not email.text or len(email.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Email text cannot be empty")
    
    try:
        is_spam, confidence = detector.predict(email.text)
        
        return SpamResponse(
            is_spam=is_spam,
            confidence=float(confidence),
            message="Spam detected" if is_spam else "Not spam"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/predict/batch")
async def predict_batch(emails: list[EmailRequest]):
    """
    Predict spam for multiple emails at once
    """
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    results = []
    for email in emails:
        try:
            is_spam, confidence = detector.predict(email.text)
            results.append({
                "is_spam": is_spam,
                "confidence": float(confidence),
                "text_preview": email.text[:50] + "..." if len(email.text) > 50 else email.text
            })
        except Exception as e:
            results.append({
                "error": str(e),
                "text_preview": email.text[:50] + "..." if len(email.text) > 50 else email.text
            })
    
    return {"results": results, "total": len(results)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)