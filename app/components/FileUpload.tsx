// app/components/FileUpload.tsx

'use client';

import { useState } from 'react';
import type { UploadResponse } from '@/lib/types';

type UploadMethod = 'csv' | 'api';

const POS_PROVIDERS = [
  { id: 'square', name: 'Square', requiresApiKey: true },
  { id: 'stripe', name: 'Stripe', requiresApiKey: true },
  { id: 'sumup', name: 'SumUp', requiresApiKey: true },
  { id: 'toast', name: 'Toast', requiresApiKey: true },
  { id: 'clover', name: 'Clover', requiresApiKey: true },
];

interface FileUploadProps {
  onUploadSuccess: (sessionId: string) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('csv');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [files, setFiles] = useState<{
    transactions?: File;
    refunds?: File;
    payouts?: File;
    products?: File;
  }>({});
  
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (type: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [type]: file || undefined }));
    setError(null);
    setSuccess(null);
  };

  const handleCSVUpload = async () => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    if (files.transactions) formData.append('transactions', files.transactions);
    if (files.refunds) formData.append('refunds', files.refunds);
    if (files.payouts) formData.append('payouts', files.payouts);
    if (files.products) formData.append('products', files.products);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data: UploadResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSessionId(data.sessionId);
      onUploadSuccess(data.sessionId);
      
      // Store session ID in localStorage
      localStorage.setItem('cashflow_session_id', data.sessionId);
      
      setSuccess(`✅ Data uploaded successfully!
        
📊 Summary:
• Transactions: ${data.summary.transactions.toLocaleString()} rows
• Refunds: ${data.summary.refunds.toLocaleString()} rows
• Payouts: ${data.summary.payouts.toLocaleString()} rows
• Products: ${data.summary.products.toLocaleString()} rows

You can now run analysis!`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAPIConnect = async () => {
    if (!selectedProvider) {
      setError('Please select a POS provider');
      return;
    }

    if (!apiKey) {
      setError('Please enter your API key');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      setSessionId(data.sessionId);
      onUploadSuccess(data.sessionId);
      
      localStorage.setItem('cashflow_session_id', data.sessionId);
      
      setSuccess(`✅ Connected to ${selectedProvider} successfully!
        
📊 Data imported:
• Transactions: ${data.summary.transactions.toLocaleString()} rows
• Refunds: ${data.summary.refunds.toLocaleString()} rows
• Payouts: ${data.summary.payouts.toLocaleString()} rows
• Products: ${data.summary.products.toLocaleString()} rows`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">📁 Upload Data</h2>
      
      {/* Upload Method Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setUploadMethod('csv')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            uploadMethod === 'csv'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📄 Upload CSV Files
        </button>
        <button
          onClick={() => setUploadMethod('api')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            uploadMethod === 'api'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🔌 Connect via API
        </button>
      </div>

      {/* CSV Upload Section */}
      {uploadMethod === 'csv' && (
        <div className="space-y-4">
          {['transactions', 'refunds', 'payouts', 'products'].map(type => (
            <div key={type}>
              <label className="block text-sm font-medium mb-2 capitalize">
                {type} CSV
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileChange(type, e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </div>
          ))}

          <button
            onClick={handleCSVUpload}
            disabled={uploading || Object.keys(files).length === 0}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg
              hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
              transition-colors font-semibold"
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload Files'}
          </button>
        </div>
      )}

      {/* API Connection Section */}
      {uploadMethod === 'api' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              POS Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setError(null);
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select your POS provider...</option>
              {POS_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your API key..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  🔒 Your API key is encrypted and never stored
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={handleAPIConnect}
                disabled={uploading || !apiKey}
                className="w-full bg-green-600 text-white py-3 rounded-lg
                  hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                  transition-colors font-semibold"
              >
                {uploading ? '⏳ Connecting...' : '🔌 Connect to ' + selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
              </button>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <p className="font-semibold">❌ Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          <pre className="text-sm whitespace-pre-wrap font-sans">{success}</pre>
        </div>
      )}
    </div>
  );
}