# python-service/main.py
from ai_assistant import CashFlowAIAssistant
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import List, Optional, Dict, Any
import sys
import os

# Add parent src to path
sys.path.append('../src')

app = FastAPI(title="Cash Flow AI Service")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom validation error handler to see what's wrong
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("=" * 60)
    print("VALIDATION ERROR!")
    print(f"Request body: {await request.body()}")
    print(f"Errors: {exc.errors()}")
    print("=" * 60)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())}
    )

# Initialize AI assistant
ai_assistant = CashFlowAIAssistant()


# ============= REQUEST MODELS =============

class CashEaterRequest(BaseModel):
    cashEaters: List[dict]
    lowMarginProducts: List[dict]
    language: str = "English"


class ReorderRequest(BaseModel):
    reorderPlan: List[dict]
    budget: float
    language: str = "English"


# ============= ENDPOINTS =============

@app.post("/analyze/cash-eaters")
async def analyze_cash_eaters(request: CashEaterRequest):
    """Specific endpoint for cash eaters analysis with pre-formatted data"""
    try:
        # Format the context string
        context = f"""
Cash Eaters Analysis:
{request.cashEaters}

Low Margin Products:
{request.lowMarginProducts}
"""
        
        # Format cash_eaters_data dictionary for the AI assistant
        cash_eaters_dict = {
            'discounts': sum(ce['amount'] for ce in request.cashEaters if ce.get('category') == 'Discounts'),
            'refunds': sum(ce['amount'] for ce in request.cashEaters if ce.get('category') == 'Refunds'),
            'processor_fees': sum(ce['amount'] for ce in request.cashEaters if ce.get('category') == 'Processor fees'),
            'low_margin_products': str(request.lowMarginProducts[:5])  # Top 5
        }

        # Call the AI assistant with the correct parameters
        insights = ai_assistant.analyze_cash_eaters(
            context,
            cash_eaters_dict,  # Second parameter - cash_eaters_data
            language=request.language.lower()
        )

        return {"insights": insights}
    
    except Exception as e:
        print(f"Error in analyze_cash_eaters: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze/reorder")
async def analyze_reorder(request: ReorderRequest):
    """Specific endpoint for reorder plan analysis"""
    try:
        # Format the context string
        context = f"""
Reorder Plan (Budget: €{request.budget}):
{request.reorderPlan}
"""
        
        # Format reorder_data dictionary for the AI assistant
        reorder_dict = {
            'purchase_plan': str(request.reorderPlan),
            'remaining_budget': request.budget
        }

        # Call the AI assistant with the correct parameters
        insights = ai_assistant.analyze_reorder_plan(
            context,
            reorder_dict,  # Second parameter - reorder_data
            request.budget,  # Third parameter - budget
            language=request.language.lower()
        )

        return {"insights": insights}
    
    except Exception as e:
        print(f"Error in analyze_reorder: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_available": ai_assistant.is_available()
    }


# ============= STARTUP =============

if __name__ == "__main__":
    import uvicorn
    print("Starting Cash Flow AI Service on port 8001...")
    print(f"AI Available: {ai_assistant.is_available()}")
    uvicorn.run(app, host="0.0.0.0", port=8001)