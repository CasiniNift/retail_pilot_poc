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

class GeneralAnalysisRequest(BaseModel):
    """Request model matching what Next.js sends"""
    analysisType: str
    language: str = "English"
    budget: float = 500.0
    snapshot: Dict[str, Any]
    cashEaters: List[Dict] = []
    lowMarginProducts: List[Dict] = []
    reorderPlan: List[Dict] = []


class CashEaterRequest(BaseModel):
    cashEaters: List[dict]
    lowMarginProducts: List[dict]
    language: str = "English"


class ReorderRequest(BaseModel):
    reorderPlan: List[dict]
    budget: float
    language: str = "English"


# ============= ENDPOINTS =============

@app.post("/analyze")
async def analyze_general(request: GeneralAnalysisRequest):
    """
    General analysis endpoint that Next.js calls
    Receives pre-parsed data from Next.js
    """
    # Log what we received
    print("=" * 60)
    print("RECEIVED REQUEST:")
    print(f"analysisType: {request.analysisType}")
    print(f"language: {request.language}")
    print(f"budget: {request.budget}")
    print(f"snapshot keys: {request.snapshot.keys() if request.snapshot else 'None'}")
    print("=" * 60)
    
    try:
        # Data is already parsed and sent in the request
        data = request.snapshot
        
        # Calculate snapshot (basic stats)
        snapshot = calculate_snapshot(data)
        result = {"snapshot": snapshot}
        
        # Determine which analysis to run based on analysisType
        if request.analysisType == "cash_eaters":
            cash_eaters, low_margin = analyze_cash_eaters_data(data)
            result["cashEaters"] = cash_eaters
            result["lowMarginProducts"] = low_margin
            
            # Generate AI insights
            context = format_business_context(snapshot, cash_eaters, low_margin)
            ai_insights = ai_assistant.analyze_cash_eaters(
                context,
                {
                    'discounts': sum(ce['amount'] for ce in cash_eaters if ce['category'] == 'Discounts'),
                    'refunds': sum(ce['amount'] for ce in cash_eaters if ce['category'] == 'Refunds'),
                    'processor_fees': sum(ce['amount'] for ce in cash_eaters if ce['category'] == 'Processor fees'),
                    'low_margin_products': str(low_margin[:5])  # Top 5
                },
                language=request.language.lower()
            )
            result["aiInsights"] = ai_insights
            
        elif request.analysisType == "reorder":
            reorder_plan = generate_reorder_plan_data(data, request.budget)
            result["reorderPlan"] = reorder_plan
            result["message"] = f"Budget: €{request.budget} planned"
            
            # Generate AI insights
            context = format_business_context(snapshot)
            ai_insights = ai_assistant.analyze_reorder_plan(
                context,
                {'purchase_plan': str(reorder_plan)},
                request.budget,
                language=request.language.lower()
            )
            result["aiInsights"] = ai_insights
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze/cash-eaters")
async def analyze_cash_eaters(request: CashEaterRequest):
    """Specific endpoint for cash eaters analysis with pre-formatted data"""
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
    """Specific endpoint for reorder plan analysis"""
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


# ============= HELPER FUNCTIONS =============

def calculate_snapshot(data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate business snapshot from transaction data"""
    transactions = data.get('transactions', [])
    refunds = data.get('refunds', [])
    payouts = data.get('payouts', [])
    
    card_sales = sum(t.get('net_sales', 0) for t in transactions if t.get('payment_type') == 'card')
    cash_sales = sum(t.get('net_sales', 0) for t in transactions if t.get('payment_type') == 'cash')
    
    return {
        'totalTransactions': len(set(t.get('transaction_id') for t in transactions)),
        'itemsSold': sum(t.get('quantity', 0) for t in transactions),
        'grossSales': sum(t.get('gross_sales', 0) for t in transactions),
        'discounts': sum(t.get('discount', 0) for t in transactions),
        'cardSales': card_sales,
        'cashSales': cash_sales,
        'processorFees': sum(p.get('processor_fees', 0) for p in payouts),
        'refunds': sum(r.get('refund_amount', 0) for r in refunds)
    }


def analyze_cash_eaters_data(data: Dict[str, Any]):
    """Analyze what's eating cash flow"""
    transactions = data.get('transactions', [])
    refunds = data.get('refunds', [])
    payouts = data.get('payouts', [])
    
    total_discounts = sum(t.get('discount', 0) for t in transactions)
    total_refunds = sum(r.get('refund_amount', 0) for r in refunds)
    total_fees = sum(p.get('processor_fees', 0) for p in payouts)
    total = total_discounts + total_refunds + total_fees
    
    cash_eaters = [
        {
            'category': 'Discounts',
            'amount': total_discounts,
            'percentage': (total_discounts / total * 100) if total > 0 else 0
        },
        {
            'category': 'Refunds',
            'amount': total_refunds,
            'percentage': (total_refunds / total * 100) if total > 0 else 0
        },
        {
            'category': 'Processor fees',
            'amount': total_fees,
            'percentage': (total_fees / total * 100) if total > 0 else 0
        }
    ]
    cash_eaters.sort(key=lambda x: x['amount'], reverse=True)
    
    # Calculate low margin products
    product_stats = {}
    for t in transactions:
        pid = t.get('product_id')
        if pid not in product_stats:
            product_stats[pid] = {
                'product_id': pid,
                'product_name': t.get('product_name', 'Unknown'),
                'revenue': 0,
                'gross_profit': 0
            }
        product_stats[pid]['revenue'] += t.get('net_sales', 0)
        product_stats[pid]['gross_profit'] += t.get('gross_profit', 0)
    
    low_margin = []
    for stats in product_stats.values():
        if stats['revenue'] > 0:
            margin_pct = stats['gross_profit'] / stats['revenue']
            low_margin.append({
                **stats,
                'margin_pct': margin_pct
            })
    
    low_margin.sort(key=lambda x: x['margin_pct'])
    
    return cash_eaters, low_margin[:10]  # Top 10 lowest margin


def generate_reorder_plan_data(data: Dict[str, Any], budget: float):
    """Generate simple reorder recommendations"""
    transactions = data.get('transactions', [])
    
    # Simple logic: recommend top-selling products that fit in budget
    product_sales = {}
    for t in transactions:
        pid = t.get('product_id')
        if pid not in product_sales:
            product_sales[pid] = {
                'product_id': pid,
                'product_name': t.get('product_name', 'Unknown'),
                'quantity_sold': 0,
                'avg_price': t.get('unit_price', 0)
            }
        product_sales[pid]['quantity_sold'] += t.get('quantity', 0)
    
    # Sort by quantity sold
    top_products = sorted(product_sales.values(), key=lambda x: x['quantity_sold'], reverse=True)
    
    # Create reorder plan within budget
    plan = []
    remaining = budget
    
    for product in top_products[:5]:  # Top 5 products
        suggested_qty = max(5, product['quantity_sold'] // 10)  # Suggest 10% of sales volume
        cost = suggested_qty * product['avg_price'] * 0.6  # Assume 40% markup
        
        if cost <= remaining:
            plan.append({
                'product_name': product['product_name'],
                'quantity': suggested_qty,
                'estimated_cost': round(cost, 2),
                'expected_revenue': round(suggested_qty * product['avg_price'], 2)
            })
            remaining -= cost
        
        if remaining < 50:  # Stop if less than €50 left
            break
    
    return plan


def format_business_context(snapshot: Dict[str, Any], cash_eaters=None, low_margin=None) -> str:
    """Format business data for AI context"""
    context = f"""
    Business Snapshot:
    - Total Sales: €{snapshot['grossSales']:.2f}
    - Transactions: {snapshot['totalTransactions']}
    - Items Sold: {snapshot['itemsSold']}
    - Discounts: €{snapshot['discounts']:.2f}
    - Refunds: €{snapshot['refunds']:.2f}
    - Processor Fees: €{snapshot['processorFees']:.2f}
    """
    
    if cash_eaters:
        context += f"\n\nTop Cash Drains:\n"
        for ce in cash_eaters[:3]:
            context += f"- {ce['category']}: €{ce['amount']:.2f} ({ce['percentage']:.1f}%)\n"
    
    if low_margin:
        context += f"\n\nLowest Margin Products:\n"
        for p in low_margin[:5]:
            context += f"- {p['product_name']}: {p['margin_pct']*100:.1f}% margin\n"
    
    return context


# ============= STARTUP =============

if __name__ == "__main__":
    import uvicorn
    print("Starting Cash Flow AI Service on port 8001...")
    print(f"AI Available: {ai_assistant.is_available()}")
    uvicorn.run(app, host="0.0.0.0", port=8001)