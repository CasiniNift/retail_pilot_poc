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

  const totalDiscounts = transactions.reduce((sum, t) => sum + t.discount, 0);
  const totalRefunds = refunds.reduce((sum, r) => sum + r.refund_amount, 0);
  const totalFees = payouts.reduce((sum, p) => sum + p.processor_fees, 0);
  const total = totalDiscounts + totalRefunds + totalFees;

  const cashEaters: CashEater[] = [
    { category: 'Discounts', amount: totalDiscounts, percentage: (totalDiscounts / total) * 100 },
    { category: 'Refunds', amount: totalRefunds, percentage: (totalRefunds / total) * 100 },
    { category: 'Processor fees', amount: totalFees, percentage: (totalFees / total) * 100 }
  ].sort((a, b) => b.amount - a.amount);

  // Low margin products
  const productStats = new Map<string, {
    revenue: number;
    gross_profit: number;
    product_name: string;
  }>();
  
  transactions.forEach(t => {
    const existing = productStats.get(t.product_id) || {
      revenue: 0,
      gross_profit: 0,
      product_name: t.product_name
    };
    
    productStats.set(t.product_id, {
      revenue: existing.revenue + t.net_sales,
      gross_profit: existing.gross_profit + t.gross_profit,
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
    // ✅ Accept BOTH 'question' and 'analysisType' for compatibility
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

    // 🔍 DEBUG: Log the loaded data
    console.log('📊 Data loaded:', {
      transactions: data.transactions?.length || 0,
      refunds: data.refunds?.length || 0,
      payouts: data.payouts?.length || 0,
      products: data.products?.length || 0
    });

    const snapshot = calculateSnapshot(data);
    
    // 🔍 DEBUG: Log the calculated snapshot
    console.log('📈 Snapshot calculated:', snapshot);
    
    let result: AnalysisResult = { snapshot };

    // Run analysis based on question
    if (question === 'cash_eaters') {
      const { cashEaters, lowMarginProducts } = analyzeCashEaters(data);
      result.cashEaters = cashEaters;
      result.lowMarginProducts = lowMarginProducts;

      // Simplified AI insights (you can connect to Python service later)
      result.aiInsights = `
        <h4>🤖 AI Analysis</h4>
        <p><strong>Biggest cash drain:</strong> ${cashEaters[0].category} (€${cashEaters[0].amount.toFixed(2)})</p>
        <p><strong>Quick win:</strong> Review ${lowMarginProducts[0]?.product_name} pricing - only ${(lowMarginProducts[0]?.margin_pct * 100).toFixed(1)}% margin</p>
      `;

    } else if (question === 'reorder') {
      result.reorderPlan = generateReorderPlan(data, budget || 500);
      result.message = `Budget: €${budget} planned`;
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