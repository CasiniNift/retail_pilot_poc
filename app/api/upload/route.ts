// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import Papa from 'papaparse';
import type { CashFlowData, UploadResponse } from '@/lib/types';

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
          console.error('CSV parsing errors:', results.errors);
        }
        resolve(results.data);
      },
      error: (error) => reject(error)
    });
  });
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

    const data: Partial<CashFlowData> = {};

    // Process each file and parse CSV properly
    for (const [key, file] of Object.entries(files)) {
      if (!file) continue;

      try {
        const parsed = await parseCSV(file);
        console.log(`✅ Parsed ${key}:`, parsed.length, 'rows');
        
        // Store the parsed data as objects, not strings!
        data[key as keyof CashFlowData] = parsed as any;
      } catch (err) {
        console.error(`Error parsing ${key}:`, err);
        return NextResponse.json(
          { error: `Failed to parse ${key}`, details: err instanceof Error ? err.message : 'Unknown error' },
          { status: 400 }
        );
      }
    }

    // ✅ ADD THIS SECTION - Calculate gross_profit for transactions
    if (data.transactions && data.products) {
      const productMap = new Map(data.products.map(p => [p.product_id, p]));
      
      data.transactions = data.transactions.map(t => {
        const product = productMap.get(t.product_id);
        const cogs = product?.cogs || 0;
        const quantity = t.quantity || 0;
        const net_sales = t.net_sales || 0;
        
        // Calculate gross profit: (net_sales - (cogs * quantity))
        const gross_profit = net_sales - (cogs * quantity);
        
        return {
          ...t,
          cogs,
          gross_profit
        };
      });
      
      console.log('✅ Calculated gross_profit for transactions');
    }

    // Create temp_data directory if it doesn't exist
    const dataDir = join(process.cwd(), 'temp_data');
    await mkdir(dataDir, { recursive: true });
    
    // Generate session ID
    const sessionId = Date.now().toString();
    
    console.log('💾 Saving data with', data.transactions?.length, 'transactions');
    
    // Save data to file as proper JSON objects
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
      },
      error: ''
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