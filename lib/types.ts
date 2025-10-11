// Core data types matching your Flask CSV schemas
export interface Transaction {
    transaction_id: string;
    day: string | Date;
    product_id: string;
    product_name: string;
    quantity: number;
    gross_sales: number;
    discount: number;
    net_sales: number;
    cogs: number;
    gross_profit: number;
    payment_type: 'card' | 'cash';
  }
  
  export interface Refund {
    refund_id: string;
    transaction_id: string;
    refund_amount: number;
    refund_date: string | Date;
  }
  
  export interface Payout {
    payout_date: string | Date;
    processor_fees: number;
    net_payout: number;
  }
  
  export interface Product {
    product_id: string;
    product_name: string;
    cogs: number;
  }
  
  // Analysis result types
  export interface CashFlowData {
    transactions?: Transaction[];
    refunds?: Refund[];
    payouts?: Payout[];
    products?: Product[];
  }
  
  export interface BusinessSnapshot {
    totalTransactions: number;
    itemsSold: number;
    grossSales: number;
    discounts: number;
    cardSales: number;
    cashSales: number;
    processorFees: number;
    refunds: number;
  }
  
  export interface CashEater {
    category: string;
    amount: number;
    percentage?: number;
  }
  
  export interface LowMarginProduct {
    product_id: string;
    product_name: string;
    revenue: number;
    gross_profit: number;
    margin_pct: number;
  }
  
  export interface ReorderItem {
    product_name: string;
    suggested_qty: number;
    budget_spend: number;
    est_weekly_profit: number;
  }
  
  export interface AnalysisResult {
    snapshot: BusinessSnapshot;
    cashEaters?: CashEater[];
    lowMarginProducts?: LowMarginProduct[];
    reorderPlan?: ReorderItem[];
    aiInsights?: string;
    message?: string;
  }
  
  // API response types
  export interface UploadResponse {
    success: boolean;
    sessionId: string;
    summary: {
      transactions: number;
      refunds: number;
      payouts: number;
      products: number;
    };
    error?: string; // optional
  }
  
  export interface ValidationError {
    file: string;
    errors: string[];
  }