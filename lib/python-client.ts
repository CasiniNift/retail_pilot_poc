import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import Papa from 'papaparse';
import type { CashFlowData, UploadResponse, ValidationError } from '@/lib/types';

// Required columns for validation (matching your Flask DEFAULT_SCHEMAS)
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

async function parseCSV(file: File): Promise<any[]> {
  const text = await file.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${JSON.stringify(results.errors)}`));
        }
        resolve(results.data);
      },
      error: (error) => reject(error)
    });
  });
}

function validateSchema(data: any[], requiredColumns: string[], fileName: string): ValidationError | null {
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const files: Record<string, File | null> = {
      transactions: formData.get('transactions') as File | null,
      refunds: formData.get('refunds') as File | null,
      payouts: formData.get('payouts') as File | null,
      products: formData.get('products') as File | null
    };

    // Check if at least one file was uploaded
    const uploadedFiles = Object.values(files).filter(f => f !== null);
    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const errors: ValidationError[] = [];
    const data: Partial<CashFlowData> = {};

    // Process each file
    for (const [key, file] of Object.entries(files)) {
      if (!file) continue;

      try {
        const parsed = await parseCSV(file);
        const error = validateSchema(
          parsed, 
          REQUIRED_COLUMNS[key as keyof typeof REQUIRED_COLUMNS], 
          key
        );

        if (error) {
          errors.push(error);
        } else {
          data[key as keyof CashFlowData] = parsed as any;
        }
      } catch (err) {
        errors.push({
          file: key,
          errors: [err instanceof Error ? err.message : 'Unknown parsing error']
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation errors', details: errors },
        { status: 400 }
      );
    }

    // Create temp_data directory if it doesn't exist
    const dataDir = join(process.cwd(), 'temp_data');
    await mkdir(dataDir, { recursive: true });
    
    // Generate session ID
    const sessionId = Date.now().toString();
    
    // Save data to file
    await writeFile(
      join(dataDir, `${sessionId}.json`),
      JSON.stringify(data, null, 2)
    );

    const response: UploadResponse = {
      success: true,
      sessionId,
      summary: {
        transactions: data.transactions?.length || 0,
        refunds: data.refunds?.length || 0,
        payouts: data.payouts?.length || 0,
        products: data.products?.length || 0
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process files', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}