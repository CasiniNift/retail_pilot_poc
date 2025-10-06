'use client';

import { useState, useEffect } from 'react';
import type { BusinessSnapshot } from '@/lib/types';

interface ExecutiveSnapshotProps {
  sessionId: string;
}

export default function ExecutiveSnapshot({ sessionId }: ExecutiveSnapshotProps) {
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSnapshot() {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            analysisType: 'snapshot'
          })
        });

        const data = await response.json();
        if (data.snapshot) {
          setSnapshot(data.snapshot);
        }
      } catch (err) {
        console.error('Failed to load snapshot:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshot();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-md p-6 text-white">
        <div className="animate-pulse">Loading snapshot...</div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-md overflow-hidden text-white">
      <div className="px-6 py-4 border-b border-purple-500">
        <h3 className="text-xl font-semibold flex items-center">
          <i className="fas fa-tachometer-alt mr-2"></i>
          Executive Snapshot
        </h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Transactions</div>
            <div className="text-2xl font-bold">{(snapshot.totalTransactions || 0).toLocaleString()}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Items Sold</div>
            <div className="text-2xl font-bold">{(snapshot.itemsSold || 0).toLocaleString()}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Gross Sales</div>
            <div className="text-2xl font-bold">€{(snapshot.grossSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Discounts</div>
            <div className="text-2xl font-bold text-red-200">€{(snapshot.discounts || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Card Sales</div>
            <div className="text-2xl font-bold">€{(snapshot.cardSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Cash Sales</div>
            <div className="text-2xl font-bold">€{(snapshot.cashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Processor Fees</div>
            <div className="text-2xl font-bold text-yellow-200">€{(snapshot.processorFees || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-sm opacity-90 mb-1">Refunds</div>
            <div className="text-2xl font-bold text-orange-200">€{(snapshot.refunds || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>
    </div>
  );
}