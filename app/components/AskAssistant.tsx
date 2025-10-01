'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/lib/types';
import ResultsDisplay from './ResultsDisplay';
// If the above doesn't work, use:
// import ResultsDisplay from '@/app/components/ResultsDisplay';

const QUESTIONS = [
  {
    id: 'cash_eaters',
    title: "What's eating my cash flow?",
    icon: 'chart-line',
    description: 'Identify discounts, refunds, and fees draining your cash',
    gradient: 'bg-gradient-to-br from-pink-100 to-red-100',
    iconColor: 'text-red-600',
    borderColor: 'border-red-200'
  },
  {
    id: 'reorder',
    title: 'What should I reorder?',
    icon: 'shopping-cart',
    description: 'Get purchase recommendations within your budget',
    gradient: 'bg-gradient-to-br from-blue-100 to-cyan-100',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  {
    id: 'free_cash',
    title: 'How much cash can I free up?',
    icon: 'coins',
    description: 'Estimate cash from clearing slow-moving inventory',
    gradient: 'bg-gradient-to-br from-yellow-100 to-amber-100',
    iconColor: 'text-yellow-600',
    borderColor: 'border-yellow-200'
  },
  {
    id: 'executive',
    title: 'Executive Summary',
    icon: 'chart-pie',
    description: 'High-level business performance overview',
    gradient: 'bg-gradient-to-br from-purple-100 to-indigo-100',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-200'
  }
];

interface AskAssistantProps {
  sessionId: string | null;
  hasData: boolean;
}

export default function AskAssistant({ sessionId, hasData }: AskAssistantProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [budget, setBudget] = useState(500);
  const [language, setLanguage] = useState('English');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (questionId: string) => {
    if (!sessionId) {
      alert('Please upload data first');
      return;
    }

    setSelectedQuestion(questionId);
    setAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question: questionId,
          budget: questionId === 'reorder' ? budget : undefined,
          language
        })
      });

      const data: AnalysisResult = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? (data as any).error : 'Analysis failed');
      }

      setResult(data);

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h3 className="text-xl font-semibold flex items-center">
          <i className="fas fa-robot mr-2"></i>
          Ask the Assistant
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {hasData 
            ? 'Select a question to analyze your data' 
            : 'Upload data first to enable analysis'}
        </p>
      </div>

      {/* Question Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {QUESTIONS.map((question) => (
            <button
              key={question.id}
              onClick={() => hasData && handleAnalyze(question.id)}
              disabled={!hasData || analyzing}
              className={`question-card p-5 rounded-lg border-2 text-left
                ${question.gradient} ${question.borderColor}
                ${!hasData ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}
                ${analyzing ? 'opacity-70' : ''}
                ${selectedQuestion === question.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-4">
                  <i className={`fas fa-${question.icon} text-3xl ${question.iconColor}`}></i>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2 text-base">{question.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{question.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Budget Input - Show when reorder selected */}
        {selectedQuestion === 'reorder' && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-sm font-medium mb-2">
              <i className="fas fa-euro-sign mr-2"></i>
              Purchase Budget (€)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              min="0"
              step="50"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Language Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            <i className="fas fa-language mr-2"></i>
            AI Response Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="English">English</option>
            <option value="Italiano">Italiano</option>
            <option value="Español">Español</option>
          </select>
        </div>

        {/* Loading State */}
        {analyzing && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Analyzing your data...</p>
          </div>
        )}

        {/* Results */}
        {result && !analyzing && (
          <ResultsDisplay result={result} questionId={selectedQuestion || ''} />
        )}

        {/* Info Message when no data */}
        {!hasData && (
          <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200">
            <i className="fas fa-info-circle text-4xl text-blue-500 mb-3"></i>
            <p className="text-blue-800 font-medium">Upload all 4 CSV files to unlock AI-powered analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}