// app/api/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Import types using @ alias
import type { 
  CashFlowData, 
  AnalysisResult, 
  CashEater, 
  LowMarginProduct,
  ReorderItem 
} from '@/lib/types';

// Simple analysis functions (TypeScript port of your Python analysis.py)
function calculateSnapshot(data: CashFlowData) {
  const { transactions = [], refunds = [], payouts = [] } = data;

  const cardSales = transactions
    .filter(t => t.payment_type === 'card')
    .reduce((sum, t) => sum + t.net_sales, 0);

  const cashSales = transactions
    .filter(t => t.payment_type === 'cash')
    .reduce((sum, t) => sum + t.net_sales, 0);

  return {
    totalTransactions: new Set(transactions.map(t => t.transaction_id)).size,
    itemsSold: transactions.reduce((sum, t) => sum + t.quantity, 0),
    grossSales: transactions.reduce((sum, t) => sum + t.gross_sales, 0),
    discounts: transactions.reduce((sum, t) => sum + t.discount, 0),
    cardSales,
    cashSales,
    processorFees: payouts.reduce((sum, p) => sum + p.processor_fees, 0),
    refunds: refunds.reduce((sum, r) => sum + r.refund_amount, 0)
  };
}

function analyzeCashEaters(data: CashFlowData) {
  const { transactions = [], refunds = [], payouts = [] } = data;

  const totalDiscounts = transactions.reduce((sum, t) => sum + (t.discount || 0), 0);
  const totalRefunds = refunds.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const totalFees = payouts.reduce((sum, p) => sum + (p.processor_fees || 0), 0);
  const total = totalDiscounts + totalRefunds + totalFees;

  const cashEaters: CashEater[] = [
    { category: 'Discounts', amount: totalDiscounts, percentage: total > 0 ? (totalDiscounts / total) * 100 : 0 },
    { category: 'Refunds', amount: totalRefunds, percentage: total > 0 ? (totalRefunds / total) * 100 : 0 },
    { category: 'Processor fees', amount: totalFees, percentage: total > 0 ? (totalFees / total) * 100 : 0 }
  ].sort((a, b) => b.amount - a.amount);

  // Low margin products - with null checks
  const productStats = new Map<string, {
    revenue: number;
    gross_profit: number;
    product_name: string;
  }>();
  
  transactions.forEach(t => {
    if (!t.product_id || !t.product_name) return;
    
    const existing = productStats.get(t.product_id) || {
      revenue: 0,
      gross_profit: 0,
      product_name: t.product_name
    };
    
    productStats.set(t.product_id, {
      revenue: existing.revenue + (t.net_sales || 0),
      gross_profit: existing.gross_profit + (t.gross_profit || 0),
      product_name: t.product_name
    });
  });

  const lowMarginProducts: LowMarginProduct[] = Array.from(productStats.entries())
    .map(([product_id, stats]) => ({
      product_id,
      product_name: stats.product_name,
      revenue: stats.revenue,
      gross_profit: stats.gross_profit,
      margin_pct: stats.revenue > 0 ? (stats.gross_profit / stats.revenue) : 0
    }))
    .filter(p => p.revenue > 0)
    .sort((a, b) => a.margin_pct - b.margin_pct)
    .slice(0, 5);

  return { cashEaters, lowMarginProducts };
}

function generateReorderPlan(data: CashFlowData, budget: number): ReorderItem[] {
  const { transactions = [] } = data;

  // Calculate days
  const dates = transactions.map(t => new Date(t.day).getTime());
  const days = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) + 1;

  // Aggregate by product
  const productStats = new Map<string, {
    name: string;
    qty: number;
    gross_profit: number;
    cogs: number;
  }>();
  
  transactions.forEach(t => {
    const existing = productStats.get(t.product_id) || {
      name: t.product_name,
      qty: 0,
      gross_profit: 0,
      cogs: t.cogs
    };

    productStats.set(t.product_id, {
      name: t.product_name,
      qty: existing.qty + t.quantity,
      gross_profit: existing.gross_profit + t.gross_profit,
      cogs: t.cogs
    });
  });

  // Rank by profitability
  const ranked = Array.from(productStats.values())
    .map(p => ({
      product_name: p.name,
      qty_per_day: p.qty / days,
      gp_per_day: p.gross_profit / days,
      cogs: p.cogs,
      qty: p.qty,
      gp: p.gross_profit
    }))
    .sort((a, b) => b.gp_per_day - a.gp_per_day);

  // Generate plan
  const plan: ReorderItem[] = [];
  let remaining = budget;

  for (const product of ranked) {
    if (product.cogs <= 0) continue;

    const targetUnits = Math.max(1, Math.ceil(product.qty_per_day * 5));
    const maxUnits = Math.floor(remaining / product.cogs);
    const buyUnits = Math.max(0, Math.min(targetUnits, maxUnits));

    if (buyUnits > 0) {
      plan.push({
        product_name: product.product_name,
        suggested_qty: buyUnits,
        budget_spend: Number((buyUnits * product.cogs).toFixed(2)),
        est_weekly_profit: Number((buyUnits * (product.gp / Math.max(1, product.qty))).toFixed(2))
      });

      remaining -= buyUnits * product.cogs;
    }

    if (remaining < Math.min(...ranked.map(p => p.cogs))) break;
  }

  return plan;
}

export async function POST(request: NextRequest) {
  try {
    // Accept BOTH 'question' and 'analysisType' for compatibility
    const body = await request.json();
    const { sessionId, budget, language } = body;
    
    // Support both field names - prefer analysisType if present, fallback to question
    const question = body.analysisType || body.question;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { error: 'analysisType or question is required' },
        { status: 400 }
      );
    }

    // Load data
    const dataPath = join(process.cwd(), 'temp_data', `${sessionId}.json`);
    const dataStr = await readFile(dataPath, 'utf-8');
    const data: CashFlowData = JSON.parse(dataStr);

    const snapshot = calculateSnapshot(data);
    let result: AnalysisResult = { snapshot };

    // Run analysis based on question
    if (question === 'cash_eaters') {
      const { cashEaters, lowMarginProducts } = analyzeCashEaters(data);
      result.cashEaters = cashEaters;
      result.lowMarginProducts = lowMarginProducts;

      // Call Python service for AI analysis
      try {
        const pythonResponse = await fetch('http://localhost:8001/analyze/cash-eaters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cashEaters,
            lowMarginProducts,
            language: language || 'English'
          })
        });

        if (pythonResponse.ok) {
          const aiData = await pythonResponse.json();
          result.aiInsights = aiData.insights;
        } else {
          console.error('Python service returned error:', pythonResponse.status);
          result.aiInsights = '<p class="text-gray-600"><strong>AI analysis unavailable.</strong> Make sure the Python service is running: <code>cd python-service && python3 main.py</code></p>';
        }
      } catch (err) {
        console.error('Failed to connect to Python service:', err);
        result.aiInsights = '<p class="text-gray-600"><strong>AI analysis unavailable.</strong> Make sure the Python service is running on port 8001.</p>';
      }

    } else if (question === 'reorder') {
      result.reorderPlan = generateReorderPlan(data, budget || 500);
      result.message = `Budget: €${budget} planned`;
      
      // Call Python service for reorder AI analysis
      try {
        const pythonResponse = await fetch('http://localhost:8001/analyze/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reorderPlan: result.reorderPlan,
            budget: budget || 500,
            language: language || 'English'
          })
        });

        if (pythonResponse.ok) {
          const aiData = await pythonResponse.json();
          result.aiInsights = aiData.insights;
        }
      } catch (err) {
        console.error('Failed to get reorder AI insights:', err);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}