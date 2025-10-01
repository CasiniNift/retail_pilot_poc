# python-service/main.py
from ai_assistant import CashFlowAIAssistant
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sys
import os

# Add your existing src to path
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

# Initialize your existing AI assistant
ai_assistant = CashFlowAIAssistant()


class CashEaterRequest(BaseModel):
    cashEaters: List[dict]
    lowMarginProducts: List[dict]
    language: str = "English"


class ReorderRequest(BaseModel):
    reorderPlan: List[dict]
    budget: float
    language: str = "English"


@app.post("/analyze/cash-eaters")
async def analyze_cash_eaters(request: CashEaterRequest):
    """Generate AI insights for cash eaters analysis"""

    # Format data for your existing AI assistant
    context = f"""
    Cash Eaters Analysis:
    {request.cashEaters}
    
    Low Margin Products:
    {request.lowMarginProducts}
    """

    insights = ai_assistant.analyze_cash_eaters(
        context,
        language=request.language
    )

    return {"insights": insights}


@app.post("/analyze/reorder")
async def analyze_reorder(request: ReorderRequest):
    """Generate AI insights for reorder plan"""

    context = f"""
    Reorder Plan (Budget: €{request.budget}):
    {request.reorderPlan}
    """

    insights = ai_assistant.analyze_reorder_plan(
        context,
        language=request.language
    )

    return {"insights": insights}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_available": ai_assistant.is_available()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
