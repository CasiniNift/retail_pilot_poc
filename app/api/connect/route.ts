import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { CashFlowData, UploadResponse } from '../../../lib/types';

interface ConnectRequest {
  provider: string;
  apiKey: string;
  startDate?: string;
  endDate?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, startDate, endDate }: ConnectRequest = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['square', 'stripe', 'sumup', 'toast', 'clover'];
    if (!validProviders.includes(provider.toLowerCase())) {
      return NextResponse.json(
        { error: `Provider '${provider}' is not supported yet` },
        { status: 400 }
      );
    }

    // TODO: In production, call your Python service to fetch data from POS APIs
    // For now, we'll return a mock response indicating the feature is coming soon
    
    // Example of what the Python service call would look like:
    /*
    const pythonResponse = await fetch('http://localhost:8001/api/pos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        startDate,
        endDate
      })
    });

    if (!pythonResponse.ok) {
      throw new Error('Failed to fetch data from POS provider');
    }

    const data: CashFlowData = await pythonResponse.json();
    */

    // Mock data for demonstration
    const mockData: CashFlowData = {
      transactions: [],
      refunds: [],
      payouts: [],
      products: []
    };

    // Create temp_data directory
    const dataDir = join(process.cwd(), 'temp_data');
    await mkdir(dataDir, { recursive: true });
    
    // Generate session ID
    const sessionId = Date.now().toString();
    
    // Save data to file
    await writeFile(
      join(dataDir, `${sessionId}.json`),
      JSON.stringify(mockData, null, 2)
    );

    const response: UploadResponse = {
        success: true,
        sessionId,
        summary: {
            transactions: mockData.transactions?.length || 0,
            refunds: mockData.refunds?.length || 0,
            payouts: mockData.payouts?.length || 0,
            products: mockData.products?.length || 0
        },
        error: ''
    };

    // Return info message for now
    return NextResponse.json({
      ...response,
      message: `API integration with ${provider} is coming soon! For now, please use CSV upload.`
    });

  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json(
      { 
        error: 'Connection failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Test endpoint to verify API key format
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider');
  
  if (!provider) {
    return NextResponse.json({ error: 'Provider parameter required' }, { status: 400 });
  }

  // Return information about the provider
  const providerInfo: Record<string, any> = {
    square: {
      name: 'Square',
      apiKeyFormat: 'Starts with "sq0atp-" or "sq0csp-"',
      docsUrl: 'https://developer.squareup.com/docs/build-basics/access-tokens'
    },
    stripe: {
      name: 'Stripe',
      apiKeyFormat: 'Starts with "sk_live_" or "sk_test_"',
      docsUrl: 'https://stripe.com/docs/keys'
    },
    sumup: {
      name: 'SumUp',
      apiKeyFormat: 'OAuth token from SumUp dashboard',
      docsUrl: 'https://developer.sumup.com/docs/authorization'
    },
    toast: {
      name: 'Toast',
      apiKeyFormat: 'API key from Toast dashboard',
      docsUrl: 'https://doc.toasttab.com/doc/platformguide/gettingStarted.html'
    },
    clover: {
      name: 'Clover',
      apiKeyFormat: 'API token from Clover dashboard',
      docsUrl: 'https://docs.clover.com/docs/using-oauth-20'
    }
  };

  const info = providerInfo[provider.toLowerCase()];
  
  if (!info) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  return NextResponse.json(info);
}