// app/api/clear/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Clear session logic here
    // For now, just return success
    return NextResponse.json({ 
      message: 'Data cleared successfully' 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Clear failed' },
      { status: 500 }
    );
  }
}