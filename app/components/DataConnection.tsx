'use client';

import { useState } from 'react';
import type { UploadResponse } from '@/lib/types';

const POS_PROVIDERS = [
  { id: 'square', name: 'Square' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'sumup', name: 'SumUp' },
  { id: 'toast', name: 'Toast' },
  { id: 'clover', name: 'Clover' },
  { id: 'shopify', name: 'Shopify' },
];

interface DataConnectionProps {
  onDataLoaded: (sessionId: string) => void;
}

export default function DataConnection({ onDataLoaded }: DataConnectionProps) {
  const [activeTab, setActiveTab] = useState<'csv' | 'api'>('csv');
  const [files, setFiles] = useState<Record<string, File>>({});
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dataStatus, setDataStatus] = useState({
    transactions: '❌ Not loaded',
    refunds: '❌ Not loaded',
    payouts: '❌ Not loaded',
    products: '❌ Not loaded',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (type: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
    } else {
      const newFiles = { ...files };
      delete newFiles[type];
      setFiles(newFiles);
    }
    setMessage(null);
  };

  const handleCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setMessage(null);

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

      // Update status
      setDataStatus({
        transactions: data.summary.transactions > 0 ? `✅ ${data.summary.transactions.toLocaleString()} rows` : '❌ Not loaded',
        refunds: data.summary.refunds > 0 ? `✅ ${data.summary.refunds.toLocaleString()} rows` : '❌ Not loaded',
        payouts: data.summary.payouts > 0 ? `✅ ${data.summary.payouts.toLocaleString()} rows` : '❌ Not loaded',
        products: data.summary.products > 0 ? `✅ ${data.summary.products} products` : '❌ Not loaded',
      });

      onDataLoaded(data.sessionId);
      setMessage({ type: 'success', text: 'Data uploaded successfully! You can now run analysis.' });
      
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleAPIConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setMessage(null);
  
    try {
      // Call Next.js API route instead of Python directly
      const response = await fetch('/api/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey, 
          startDate, 
          endDate 
        })
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Connection failed');
      }
  
      // Update status
      setDataStatus({
        transactions: data.data.charges?.count > 0 ? `✅ ${data.data.charges.count} charges` : '❌ Not loaded',
        refunds: data.data.refunds?.count > 0 ? `✅ ${data.data.refunds.count} refunds` : '❌ Not loaded',
        payouts: data.data.payouts?.count > 0 ? `✅ ${data.data.payouts.count} payouts` : '❌ Not loaded',
        products: '⚠️ N/A for Stripe',
      });
  
      const sessionId = data.sessionId;
      localStorage.setItem('cashflow_session_id', sessionId);
      onDataLoaded(sessionId);
      
      setMessage({ 
        type: 'success', 
        text: `Connected successfully! Fetched ${data.data.charges?.count || 0} charges` 
      });
      
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h3 className="text-xl font-semibold flex items-center">
          <i className="fas fa-plug mr-2"></i>
          Data Connection
        </h3>
        <p className="text-sm text-gray-600 mt-1">Choose how to connect your POS data</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex-1 py-3 px-4 font-medium transition-colors ${
            activeTab === 'csv'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="fas fa-file-csv mr-2"></i>
          CSV Upload
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`flex-1 py-3 px-4 font-medium transition-colors ${
            activeTab === 'api'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="fas fa-cloud mr-2"></i>
          API Connection
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'csv' ? (
          <form onSubmit={handleCSVUpload}>
            <div className="bg-gray-50 p-5 rounded-lg border-2 border-dashed border-gray-300 mb-4">
              <h4 className="font-semibold mb-4 flex items-center">
                <i className="fas fa-upload mr-2"></i>
                Upload Your CSV Files
              </h4>
              <p className="text-sm text-gray-600 mb-4">Upload the following 4 CSV files from your POS system</p>

              <div className="space-y-3">
                {[
                  { key: 'transactions', icon: 'receipt', label: 'Transactions CSV' },
                  { key: 'refunds', icon: 'undo', label: 'Refunds CSV' },
                  { key: 'payouts', icon: 'credit-card', label: 'Payouts CSV' },
                  { key: 'products', icon: 'box', label: 'Product Master CSV' }
                ].map(({ key, icon, label }) => (
                  <div key={key} className="flex items-center">
                    <i className={`fas fa-${icon} text-gray-400 mr-3`}></i>
                    <label className="flex-1">
                      <span className="text-sm font-medium">{label}</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 mt-1
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100 cursor-pointer"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || Object.keys(files).length === 0}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold
                hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center"
            >
              <i className="fas fa-cloud-upload-alt mr-2"></i>
              {uploading ? 'Uploading...' : 'Upload & Process Data'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAPIConnect}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <i className="fas fa-store mr-2"></i>
                  POS Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  required
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select your POS provider...</option>
                  {POS_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {provider && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <i className="fas fa-key mr-2"></i>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                      placeholder="Enter your API key..."
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      <i className="fas fa-lock mr-1"></i>
                      Your API key is encrypted and never stored
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold
                      hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                      transition-colors flex items-center justify-center"
                  >
                    <i className="fas fa-download mr-2"></i>
                    {uploading ? 'Connecting...' : 'Connect & Fetch Data'}
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* Messages */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-start">
              <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2 mt-0.5`}></i>
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <a
            href="/sample_formats"
            className="text-center py-2 px-4 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
          >
            <i className="fas fa-info-circle mr-1"></i>
            CSV Format Guide
          </a>
          <button
            onClick={() => {
              if (confirm('Clear all data? This cannot be undone.')) {
                setDataStatus({
                  transactions: '❌ Not loaded',
                  refunds: '❌ Not loaded',
                  payouts: '❌ Not loaded',
                  products: '❌ Not loaded',
                });
                localStorage.removeItem('cashflow_session_id');
                setMessage({ type: 'success', text: 'Data cleared successfully' });
              }
            }}
            className="text-center py-2 px-4 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <i className="fas fa-trash mr-1"></i>
            Clear Data
          </button>
        </div>

        {/* Data Status */}
        <div className="mt-6">
          <h5 className="font-semibold mb-3 flex items-center">
            <i className="fas fa-chart-bar mr-2"></i>
            Current Data Status
          </h5>
          <div className="space-y-2">
            {Object.entries(dataStatus).map(([key, status]) => (
              <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm capitalize">{key}:</span>
                <span className={`text-sm font-medium ${
                  status.includes('✅') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}