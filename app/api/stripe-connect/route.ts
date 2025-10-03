import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Call Python backend
    const response = await fetch('http://localhost:8001/connect/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: body.apiKey,
        start_date: body.startDate,
        end_date: body.endDate,
      }),
    });

    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Connection failed' },
      { status: 500 }
    );
  }
}