import { NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const tempDir = join(process.cwd(), 'temp_data');
    await mkdir(tempDir, { recursive: true });
    
    const sessionId = Date.now().toString();
    const summary = {
      transactions: 0,
      refunds: 0,
      payouts: 0,
      products: 0
    };
    
    const csvData: any = {};
    const entries = Array.from(formData.entries());
    
    // Save CSV files and store data
    for (const [key, value] of entries) {
      if (value instanceof File) {
        const bytes = await value.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Save CSV file
        const filePath = join(tempDir, `${key}_${sessionId}.csv`);
        await writeFile(filePath, buffer);
        
        // Parse CSV content
        const content = buffer.toString();
        const lines = content.split('\n').filter(line => line.trim());
        const rowCount = lines.length - 1; // Subtract header
        
        // Store for JSON
        csvData[key] = lines;
        
        if (key === 'transactions') summary.transactions = rowCount;
        else if (key === 'refunds') summary.refunds = rowCount;
        else if (key === 'payouts') summary.payouts = rowCount;
        else if (key === 'products') summary.products = rowCount;
      }
    }
    
    // Create consolidated JSON file for analysis
    const jsonPath = join(tempDir, `${sessionId}.json`);
    await writeFile(jsonPath, JSON.stringify({
      sessionId,
      uploadedAt: new Date().toISOString(),
      data: csvData,
      summary
    }, null, 2));
    
    return NextResponse.json({
      success: true,
      sessionId,
      summary
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}