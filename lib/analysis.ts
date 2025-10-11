// lib/analysis.ts
import type { 
    CashFlowData, 
    AnalysisResult, 
    BusinessSnapshot,
    CashEater,
    LowMarginProduct,
    ReorderItem
  } from './types';
  
  export function calculateExecutiveSnapshot(data: CashFlowData): BusinessSnapshot {
    const { transactions, refunds, payouts } = data;
  
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
  
  export function analyzeCashEaters(data: CashFlowData): {
    cashEaters: CashEater[];
    lowMarginProducts: LowMarginProduct[];
  } {
    const { transactions, refunds, payouts } = data;
  
    // Calculate cash eaters
    const totalDiscounts = transactions.reduce((sum, t) => sum + t.discount, 0);
    const totalRefunds = refunds.reduce((sum, r) => sum + r.refund_amount, 0);
    const totalFees = payouts.reduce((sum, p) => sum + p.processor_fees, 0);
  
    const total = totalDiscounts + totalRefunds + totalFees;
  
    const cashEaters: CashEater[] = [
      {
        category: 'Discounts',
        amount: totalDiscounts,
        percentage: (totalDiscounts / total) * 100
      },
      {
        category: 'Refunds',
        amount: totalRefunds,
        percentage: (totalRefunds / total) * 100
      },
      {
        category: 'Processor fees',
        amount: totalFees,
        percentage: (totalFees / total) * 100
      }
    ].sort((a, b) => b.amount - a.amount);
  
    // Calculate low margin products
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
      .sort((a, b) => a.margin_pct - b.margin_pct || a.revenue - b.revenue)
      .slice(0, 5);
  
    return { cashEaters, lowMarginProducts };
  }
  
  export function generateReorderPlan(
    data: CashFlowData, 
    budget: number
  ): ReorderItem[] {
    const { transactions } = data;
  
    // Calculate date range
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
  
    // Calculate daily metrics and rank
    const ranked = Array.from(productStats.values())
      .map(p => ({
        product_name: p.name,
        qty_per_day: p.qty / days,
        gp_per_day: p.gross_profit / days,
        cogs: p.cogs,
        qty: p.qty,
        gp: p.gross_profit
      }))
      .sort((a, b) => b.gp_per_day - a.gp_per_day || b.qty_per_day - a.qty_per_day);
  
    // Generate purchase plan
    const plan: ReorderItem[] = [];
    let remaining = budget;
  
    for (const product of ranked) {
      if (product.cogs <= 0) continue;
  
      const targetUnits = Math.max(1, Math.ceil(product.qty_per_day * 5));
      const maxUnitsByBudget = Math.floor(remaining / product.cogs);
      const buyUnits = Math.max(0, Math.min(targetUnits, maxUnitsByBudget));
  
      if (buyUnits > 0) {
        plan.push({
          product_name: product.product_name,
          suggested_qty: buyUnits,
          budget_spend: Number((buyUnits * product.cogs).toFixed(2)),
          est_weekly_profit: Number((buyUnits * (product.gp / Math.max(1, product.qty))).toFixed(2))
        });
  
        remaining -= buyUnits * product.cogs;
      }
  
      if (remaining < Math.min(...ranked.map(p => p.cogs))) {
        break;
      }
    }
  
    return plan;
  }