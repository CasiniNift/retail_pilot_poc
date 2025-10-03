# python-service/main.py with comprehensive logging
from ai_assistant import CashFlowAIAssistant
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import sys
import os
import time

# Add parent directory to path to import from python-service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


# Import logger
try:
    from logger import (
        initialize_logging,
        log_app_info,
        log_app_warning,
        log_error,
        log_exceptions
    )
    LOGGING_AVAILABLE = True
    initialize_logging()
except ImportError:
    LOGGING_AVAILABLE = False
    def log_app_info(*args, **kwargs): pass
    def log_app_warning(*args, **kwargs): pass
    def log_error(*args, **kwargs): pass
    def log_exceptions(): return lambda f: f

app = FastAPI(title="Cash Flow AI Service")

log_app_info("FastAPI application starting")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log_app_info("CORS middleware configured for Next.js")

# Initialize your existing AI assistant
ai_assistant = CashFlowAIAssistant()

# Middleware to log all requests


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and responses"""
    start_time = time.time()

    log_app_info(f"Request: {request.method} {request.url.path}")

    try:
        response = await call_next(request)

        process_time = time.time() - start_time
        log_app_info(
            f"Response: {request.url.path} - Status: {response.status_code} - Time: {process_time:.3f}s")

        return response
    except Exception as e:
        log_error(f"Request failed: {request.url.path}", exc_info=True)
        raise


class AnalysisRequest(BaseModel):
    cashEaters: List[Dict[str, Any]] = []
    lowMarginProducts: List[Dict[str, Any]] = []
    reorderPlan: List[Dict[str, Any]] = []
    snapshot: Dict[str, Any] = {}
    budget: float = 0
    language: str = "English"
    analysisType: str  # 'cash_eaters', 'reorder', 'executive'


@app.get("/")
def root():
    log_app_info("Root endpoint accessed")
    return {
        "service": "Cash Flow AI Assistant",
        "status": "running",
        "claude_available": ai_assistant.is_available()
    }


@app.get("/health")
def health_check():
    ai_available = ai_assistant.is_available()
    log_app_info(f"Health check - AI Available: {ai_available}")

    return {
        "status": "healthy",
        "claude_available": ai_available
    }


@app.post("/analyze")
@log_exceptions()
async def analyze(request: AnalysisRequest):
    """Universal endpoint that routes to appropriate analysis"""

    log_app_info(
        f"Analysis request - Type: {request.analysisType}, Language: {request.language}")

    if not ai_assistant.is_available():
        log_app_warning(
            f"Analysis requested but AI not available - Type: {request.analysisType}")
        return {
            "insights": "<p>⚠️ AI service not available. Please set ANTHROPIC_API_KEY environment variable.</p>"
        }

    try:
        if request.analysisType == "cash_eaters":
            log_app_info("Processing cash eaters analysis")
            # Use your existing ai_assistant methods
            insights = ai_assistant.analyze_cash_eaters_insights(
                request.cashEaters,
                request.lowMarginProducts,
                request.language
            )
            log_app_info("Cash eaters analysis completed successfully")

        elif request.analysisType == "reorder":
            log_app_info(
                f"Processing reorder analysis - Budget: €{request.budget}")
            insights = ai_assistant.analyze_reorder_insights(
                request.reorderPlan,
                request.budget,
                request.language
            )
            log_app_info("Reorder analysis completed successfully")

        elif request.analysisType == "executive":
            log_app_info("Processing executive summary analysis")
            insights = ai_assistant.analyze_executive_insights(
                request.snapshot,
                request.language
            )
            log_app_info("Executive summary completed successfully")

        else:
            log_app_warning(
                f"Unknown analysis type requested: {request.analysisType}")
            insights = "<p>Unknown analysis type</p>"

        return {"insights": insights}

    except Exception as e:
        log_error(
            f"Analysis failed for {request.analysisType}: {str(e)}", exc_info=True)
        return {"insights": f"<p>Error: {str(e)}</p>"}


@app.on_event("startup")
async def startup_event():
    """Log startup event"""
    log_app_info("=" * 60)
    log_app_info("Cash Flow AI Service - FastAPI STARTED")
    log_app_info(f"AI Available: {ai_assistant.is_available()}")
    log_app_info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Log shutdown event"""
    log_app_info("Cash Flow AI Service - FastAPI SHUTTING DOWN")


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting Cash Flow AI Service")
    print(
        f"📊 Claude API: {'✅ Connected' if ai_assistant.is_available() else '❌ Not configured'}")
    print("🌐 http://localhost:8001")

    log_app_info("Starting uvicorn server on port 8001")

    try:
        uvicorn.run(app, host="0.0.0.0", port=8001)
    except Exception as e:
        log_error(f"Failed to start uvicorn: {e}", exc_info=True)
        raise
