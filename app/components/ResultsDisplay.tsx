'use client';

import type { AnalysisResult } from '@/lib/types';

interface ResultsDisplayProps {
  result: AnalysisResult;
  questionId: string;
}

export default function ResultsDisplay({ result, questionId }: ResultsDisplayProps) {
  return (
    <div className="mt-6 space-y-6">
      {/* Cash Eaters Table */}
      {result.cashEaters && result.cashEaters.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b">
            <h4 className="font-semibold text-red-900 flex items-center">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              💸 Cash Drains
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.cashEaters.map((eater, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{eater.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      €{eater.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {eater.percentage?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Margin Products */}
      {result.lowMarginProducts && result.lowMarginProducts.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 border-b">
            <h4 className="font-semibold text-orange-900 flex items-center">
              <i className="fas fa-arrow-down mr-2"></i>
              📉 Lowest Margin Products
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Product</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Revenue</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Profit</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.lowMarginProducts.map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      €{product.revenue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      €{product.gross_profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-medium ${
                        product.margin_pct < 0.2 ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {(product.margin_pct * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reorder Plan */}
      {result.reorderPlan && result.reorderPlan.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-4 py-3 border-b">
            <h4 className="font-semibold text-blue-900 flex items-center">
              <i className="fas fa-shopping-cart mr-2"></i>
              🛒 Suggested Purchase Plan
            </h4>
          </div>
          {result.message && (
            <div className="bg-blue-50 px-4 py-2 border-b text-sm text-blue-800">
              {result.message}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Product</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Est. Weekly Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.reorderPlan.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.suggested_qty}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      €{item.budget_spend.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                      €{item.est_weekly_profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {result.aiInsights && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500 p-6">
          <h4 className="font-semibold text-green-900 flex items-center mb-3">
            <i className="fas fa-robot mr-2"></i>
            🤖 AI Analysis
          </h4>
          <div 
            className="text-gray-800 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: result.aiInsights }}
          />
        </div>
      )}
    </div>
  );
}