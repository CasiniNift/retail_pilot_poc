// app/components/AnalysisSelector.tsx
import type { AnalysisResult, BusinessSnapshot } from '@/lib/types';
'use client';

import { useState } from 'react';
import ResultsDisplay from './ResultsDisplay';
import type { AnalysisResult } from '@/lib/types';

const QUESTIONS = [
  { id: 'cash_eaters', label: "What's eating my cash flow?" },
  { id: 'reorder', label: 'What should I reorder with budget?' },
  { id: 'free_up', label: 'How much cash can I free up?' }
];

export default function AnalysisSelector() {
  const [selectedQuestion, setSelectedQuestion] = useState('cash_eaters');
  const [budget, setBudget] = useState(500);
  const [language, setLanguage] = useState('English');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    const sessionId = localStorage.getItem('cashflow_session_id');
    
    if (!sessionId) {
      alert('Please upload CSV files first');
      return;
    }

    setAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question: selectedQuestion,
          budget: selectedQuestion === 'reorder' ? budget : undefined,
          language
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">🔍 Run Analysis</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Question
          </label>
          <select
            value={selectedQuestion}
            onChange={(e) => setSelectedQuestion(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {QUESTIONS.map(q => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </div>

        {selectedQuestion === 'reorder' && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Budget (€)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full p-2 border rounded"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="English">English</option>
            <option value="Italiano">Italiano</option>
            <option value="Español">Español</option>
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full bg-green-600 text-white py-3 rounded-lg
            hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
            transition-colors font-semibold"
        >
          {analyzing ? 'Analyzing...' : '🚀 Run Analysis'}
        </button>
      </div>

      {result && <ResultsDisplay result={result} />}
    </div>
  );
}