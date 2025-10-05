// app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { CashFlowData, AnalysisResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, analysisType, budget = 500, language = 'English' } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Load the JSON file - data is already parsed from CSV upload
    const dataPath = join(process.cwd(), 'temp_data', `${sessionId}.json`);
    const dataStr = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(dataStr);

    // Call Python backend for AI analysis
    const response = await fetch('http://localhost:8001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisType,
        language,
        budget,
        snapshot: data,
        cashEaters: [],
        lowMarginProducts: [],
        reorderPlan: []
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Python backend error:', errorData);
      throw new Error('Python backend analysis failed');
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}