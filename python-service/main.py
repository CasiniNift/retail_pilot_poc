# python-service/main.py with comprehensive logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import sys
import os
import time
import stripe
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import from python-service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_assistant import CashFlowAIAssistant

# Define project root (one level up from python-service)
PROJECT_ROOT = Path(__file__).parent.parent

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

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    """Manual CORS handler"""
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        return JSONResponse(
            content={},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
            }
        )
    
    # Process the request
    response = await call_next(request)
    
    # Add CORS headers to response
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

# Initialize your existing AI assistant
ai_assistant = CashFlowAIAssistant()


class AnalysisRequest(BaseModel):
    cashEaters: List[Dict[str, Any]] = []
    lowMarginProducts: List[Dict[str, Any]] = []
    reorderPlan: List[Dict[str, Any]] = []
    snapshot: Dict[str, Any] = {}
    budget: float = 0
    language: str = "English"
    analysisType: str  # 'cash_eaters', 'reorder', 'executive'


class StripeConnectionRequest(BaseModel):
    api_key: str
    start_date: str  # Format: "YYYY-MM-DD"
    end_date: str    # Format: "YYYY-MM-DD"


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


@app.post("/connect/stripe")
async def connect_stripe(request: StripeConnectionRequest):
    """Connect to Stripe and fetch data"""

    log_app_info(
        f"Stripe connection requested - Date range: {request.start_date} to {request.end_date}")

    try:
        stripe.api_key = request.api_key

        start_timestamp = int(datetime.strptime(
            request.start_date, "%Y-%m-%d").timestamp())
        end_timestamp = int(datetime.strptime(
            request.end_date, "%Y-%m-%d").timestamp())

        log_app_info(
            f"Fetching Stripe data from {start_timestamp} to {end_timestamp}")

        data_summary = {
            "success": True,
            "date_range": {
                "start": request.start_date,
                "end": request.end_date
            },
            "data": {}
        }

        # Fetch Charges
        try:
            charges = stripe.Charge.list(
                created={"gte": start_timestamp, "lte": end_timestamp},
                limit=100
            )
            data_summary["data"]["charges"] = {
                "count": len(charges.data),
                "total_amount": sum(charge.amount / 100 for charge in charges.data)
            }
            log_app_info(f"Fetched {len(charges.data)} charges")
        except Exception as e:
            log_error(f"Error fetching charges: {e}", exc_info=True)
            data_summary["data"]["charges"] = {"error": str(e)}

        # Fetch Refunds
        try:
            refunds = stripe.Refund.list(
                created={"gte": start_timestamp, "lte": end_timestamp},
                limit=100
            )
            data_summary["data"]["refunds"] = {
                "count": len(refunds.data),
                "total_amount": sum(refund.amount / 100 for refund in refunds.data)
            }
            log_app_info(f"Fetched {len(refunds.data)} refunds")
        except Exception as e:
            log_error(f"Error fetching refunds: {e}", exc_info=True)
            data_summary["data"]["refunds"] = {"error": str(e)}

        # Fetch Payouts
        try:
            payouts = stripe.Payout.list(
                arrival_date={"gte": start_timestamp, "lte": end_timestamp},
                limit=100
            )
            data_summary["data"]["payouts"] = {
                "count": len(payouts.data),
                "total_amount": sum(payout.amount / 100 for payout in payouts.data)
            }
            log_app_info(f"Fetched {len(payouts.data)} payouts")
        except Exception as e:
            log_error(f"Error fetching payouts: {e}", exc_info=True)
            data_summary["data"]["payouts"] = {"error": str(e)}

        # Save to file for analysis
        try:
            import json

            temp_dir = PROJECT_ROOT / "temp_data"
            temp_dir.mkdir(exist_ok=True)

            session_id = f"stripe_{int(time.time() * 1000)}"
            file_path = temp_dir / f"{session_id}.json"

            with open(file_path, 'w') as f:
                json.dump(data_summary, f, indent=2)

            log_app_info(f"Saved Stripe data to {file_path}")

            data_summary["sessionId"] = session_id

        except Exception as e:
            log_error(f"Failed to save Stripe data: {e}", exc_info=True)

        log_app_info(f"Stripe data fetch complete")

        # Return with explicit CORS headers
        return JSONResponse(
            content=data_summary,
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true",
            }
        )

    except stripe.error.AuthenticationError as e:
        log_error(f"Stripe authentication failed: {e}", exc_info=True)
        return JSONResponse(
            content={"success": False, "error": "Invalid Stripe API key"},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true",
            }
        )
    except Exception as e:
        log_error(f"Stripe connection failed: {e}", exc_info=True)
        return JSONResponse(
            content={"success": False, "error": str(e)},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true",
            }
        )


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