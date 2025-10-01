'use client';

import { useState, useEffect } from 'react';
import DataConnection from './components/DataConnection';
import AskAssistant from './components/AskAssistant';
import ExecutiveSnapshot from './components/ExecutiveSnapshot';

export default function Dashboard() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [aiAvailable] = useState(true); // Will connect to Python service later

  useEffect(() => {
    // Check if we have a session on mount
    const storedSessionId = localStorage.getItem('cashflow_session_id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      setHasData(true);
    }
  }, []);

  const handleDataLoaded = (newSessionId: string) => {
    setSessionId(newSessionId);
    setHasData(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">☕</span>
              <h1 className="text-2xl font-bold text-gray-800">AI POS – Cash Flow Assistant</h1>
            </div>
            <div className="text-sm text-gray-600">Coffee Shop Edition</div>
          </div>
          <p className="text-gray-600 mt-2">
            Upload your POS CSV data or connect via API to get AI-powered cash flow insights
          </p>
        </div>
      </div>

      {/* AI Status Banner */}
      {aiAvailable && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center text-green-800">
              <i className="fas fa-robot mr-2"></i>
              <span className="font-medium">Claude AI: Active - Advanced insights enabled</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-5 gap-6">
          {/* LEFT COLUMN - Data Connection (2/5) */}
          <div className="col-span-5 sm:col-span-2">
            <DataConnection onDataLoaded={handleDataLoaded} />
          </div>

          {/* RIGHT COLUMN - Analysis & Snapshot (3/5) */}
          <div className="col-span-5 sm:col-span-3 space-y-6">
            {/* Executive Snapshot - Only show if data loaded */}
            {hasData && sessionId && (
              <ExecutiveSnapshot sessionId={sessionId} />
            )}

            {/* Ask Assistant */}
            <AskAssistant sessionId={sessionId} hasData={hasData} />
          </div>
        </div>
      </div>
    </div>
  );
}