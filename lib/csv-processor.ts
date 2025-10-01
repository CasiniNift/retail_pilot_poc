// lib/csv-processor.ts
import Papa from 'papaparse';
import type { CashFlowData, Transaction, Refund, Payout, Product } from './types';

export interface CSVFiles {
  transactions?: File;
  refunds?: File;
  payouts?: File;
  products?: File;
}

interface ValidationError {
  file: string;
  errors: string[];
}

// Schema validation (mirrors your DEFAULT_SCHEMAS)
const REQUIRED_COLUMNS = {
  transactions: [
    'transaction_id', 'day', 'product_id', 'product_name', 
    'quantity', 'gross_sales', 'discount', 'net_sales', 
    'cogs', 'gross_profit', 'payment_type'
  ],
  refunds: ['refund_id', 'transaction_id', 'refund_amount', 'refund_date'],
  payouts: ['payout_date', 'processor_fees', 'net_payout'],
  products: ['product_id', 'product_name', 'cogs']
};

export async function parseCSVFile<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(), // Strip whitespace
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${JSON.stringify(results.errors)}`));
        }
        resolve(results.data as T[]);
      },
      error: (error) => reject(error)
    });
  });
}

export function validateSchema(
  data: any[], 
  requiredColumns: string[], 
  fileName: string
): ValidationError | null {
  if (data.length === 0) {
    return { file: fileName, errors: ['File is empty'] };
  }

  const headers = Object.keys(data[0]);
  const missing = requiredColumns.filter(col => !headers.includes(col));
  
  if (missing.length > 0) {
    return {
      file: fileName,
      errors: [`Missing required columns: ${missing.join(', ')}`]
    };
  }

  return null;
}

export async function processCashFlowFiles(files: CSVFiles): Promise<{
  data: CashFlowData;
  errors: ValidationError[];
}> {
  const errors: ValidationError[] = [];
  const data: Partial<CashFlowData> = {};

  try {
    // Parse transactions
    if (files.transactions) {
      const transactions = await parseCSVFile<Transaction>(files.transactions);
      const error = validateSchema(transactions, REQUIRED_COLUMNS.transactions, 'transactions');
      if (error) {
        errors.push(error);
      } else {
        // Convert date strings to Date objects
        data.transactions = transactions.map(t => ({
          ...t,
          day: new Date(t.day)
        }));
      }
    }

    // Parse refunds
    if (files.refunds) {
      const refunds = await parseCSVFile<Refund>(files.refunds);
      const error = validateSchema(refunds, REQUIRED_COLUMNS.refunds, 'refunds');
      if (error) {
        errors.push(error);
      } else {
        data.refunds = refunds.map(r => ({
          ...r,
          refund_date: new Date(r.refund_date)
        }));
      }
    }

    // Parse payouts
    if (files.payouts) {
      const payouts = await parseCSVFile<Payout>(files.payouts);
      const error = validateSchema(payouts, REQUIRED_COLUMNS.payouts, 'payouts');
      if (error) {
        errors.push(error);
      } else {
        data.payouts = payouts.map(p => ({
          ...p,
          payout_date: new Date(p.payout_date)
        }));
      }
    }

    // Parse products
    if (files.products) {
      const products = await parseCSVFile<Product>(files.products);
      const error = validateSchema(products, REQUIRED_COLUMNS.products, 'products');
      if (error) {
        errors.push(error);
      } else {
        data.products = products;
      }
    }

  } catch (err) {
    errors.push({
      file: 'general',
      errors: [err instanceof Error ? err.message : 'Unknown parsing error']
    });
  }

  return {
    data: data as CashFlowData,
    errors
  };
}