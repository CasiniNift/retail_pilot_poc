# AI POS - Cash Flow Assistant

A Next.js-based web application that provides AI-powered cash flow analysis for coffee shops and restaurants. Upload POS data via CSV or connect directly through API integrations to get instant insights powered by Claude AI.

## Features

- **Multiple Data Input Methods**
  - CSV file upload (Transactions, Refunds, Payouts, Product Master)
  - Direct API integration with POS providers (Square, Stripe, SumUp, Toast, Clover)
- **AI-Powered Analysis**
  - Cash flow drain identification (discounts, refunds, fees)
  - Low margin product detection
  - Smart reorder recommendations with budget optimization
  - Executive summary with business health metrics
- **Multi-language Support**
  - AI insights available in English, Italian, and Spanish
- **Real-time Data Validation**
  - Schema validation for uploaded CSV files
  - Live data status indicators

## Tech Stack

### Frontend

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React 18** with Server Components

### Backend

- **Next.js API Routes** for file handling and data processing
- **Python FastAPI** microservice for AI analysis
- **Claude AI (Anthropic)** for generating insights

### Data Processing

- **Papaparse** for CSV parsing
- **Pandas** (Python) for data analysis

## Project Structure

```
retail_pilot_poc/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── analyze/
│   │   │   └── route.ts         # Analysis endpoint (calls Python service)
│   │   ├── upload/
│   │   │   └── route.ts         # CSV upload handler
│   │   └── connect/
│   │       └── route.ts         # POS API connection handler
│   ├── components/               # React components
│   │   ├── DataConnection.tsx   # CSV upload + API connection UI
│   │   ├── AskAssistant.tsx     # Analysis question selector
│   │   ├── ExecutiveSnapshot.tsx # Business metrics display
│   │   └── ResultsDisplay.tsx   # Analysis results renderer
│   ├── layout.tsx               # Root layout with Font Awesome
│   ├── page.tsx                 # Main dashboard page
│   └── globals.css              # Global styles + Tailwind
│
├── lib/                         # Shared TypeScript code
│   ├── types.ts                 # TypeScript type definitions
│   ├── analysis.ts              # Client-side analysis functions
│   └── csv-processor.ts         # CSV parsing and validation
│
├── python-service/              # Python AI microservice
│   ├── main.py                  # FastAPI server
│   ├── ai_assistant.py          # Claude AI integration
│   ├── analysis.py              # Data analysis logic
│   ├── utils.py                 # Utility functions
│   └── requirements.txt         # Python dependencies
│
├── temp_data/                   # Temporary session data storage
├── public/                      # Static assets
├── .env.local                   # Environment variables (not in git)
├── package.json                 # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.ts           # Tailwind CSS configuration
└── next.config.js               # Next.js configuration
```

## Key File Relationships

### Data Flow Architecture

```
User uploads CSV
    ↓
app/api/upload/route.ts
    ↓
lib/csv-processor.ts (validates & parses)
    ↓
Saves to temp_data/{sessionId}.json
    ↓
User selects analysis question
    ↓
app/api/analyze/route.ts
    ↓
lib/analysis.ts (calculates metrics)
    ↓
python-service/main.py (via HTTP)
    ↓
ai_assistant.py (calls Claude API)
    ↓
Returns AI insights
    ↓
ResultsDisplay.tsx (renders results)
```

### Component Hierarchy

```
app/page.tsx (Main Dashboard)
├── DataConnection.tsx
│   ├── CSV Upload Form
│   ├── API Connection Form
│   └── Current Data Status
│
└── AskAssistant.tsx
    ├── Question Cards (4 options)
    ├── Budget Input (for reorder)
    ├── Language Selector
    └── ResultsDisplay.tsx
        ├── Cash Eaters Table
        ├── Low Margin Products Table
        ├── Reorder Plan Table
        └── AI Insights Panel
```

### Type System Flow

1. **CSV Data** → `lib/types.ts` defines Transaction, Refund, Payout, Product interfaces
2. **Validation** → `lib/csv-processor.ts` checks against required schemas
3. **Analysis** → `lib/analysis.ts` transforms into AnalysisResult type
4. **Display** → Components receive typed props for rendering

## Installation & Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- Anthropic API key (for Claude AI)

### 1. Clone the Repository

```bash
git clone https://github.com/CasiniNift/retail_pilot_poc.git
cd retail_pilot_poc
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv python-service/venv

# Activate virtual environment
# On macOS/Linux:
source python-service/venv/bin/activate
# On Windows:
# python-service\venv\Scripts\activate

# Install Python dependencies
pip install -r python-service/requirements.txt
```

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Anthropic API Key (required for AI insights)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Python service URL (default for local development)
PYTHON_AI_URL=http://localhost:8001
```

**To get an Anthropic API key:**

1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Generate a new key

### 5. Launch the Application

You need to run both the Next.js frontend and Python backend simultaneously.

**Terminal 1 - Next.js Frontend:**

```bash
npm run dev
```

The application will be available at http://localhost:3000

**Terminal 2 - Python AI Service:**

```bash
# Make sure virtual environment is activated
source python-service/venv/bin/activate

# Start the Python service
cd python-service
python3 main.py
```

The Python service will run at http://localhost:8001

### 6. Verify Setup

1. Open http://localhost:3000 in your browser
2. Check that the green banner shows "Claude AI: Active - Advanced insights enabled"
3. Upload sample CSV files or use the test data generator
4. Select an analysis question and verify AI insights appear

## Development Workflow

### Starting Development

```bash
# Terminal 1: Frontend (auto-reloads on file changes)
npm run dev

# Terminal 2: Python backend (auto-reloads with uvicorn)
source python-service/venv/bin/activate
cd python-service
python main.py
```

### Making Changes

**Frontend Changes:**

- Edit files in `app/` or `lib/`
- Next.js will hot-reload automatically
- Check browser console for errors

**Backend Changes:**

- Edit files in `python-service/`
- FastAPI with uvicorn auto-reloads on save
- Check terminal for Python errors

**Adding New Analysis Types:**

1. Add type definitions in `lib/types.ts`
2. Create analysis logic in `lib/analysis.ts`
3. Add Python handler in `python-service/main.py`
4. Update `ResultsDisplay.tsx` to render new output

### Testing CSV Upload

Sample CSV files should have these columns:

**transactions.csv:**

```
transaction_id,day,product_id,product_name,quantity,gross_sales,discount,net_sales,cogs,gross_profit,payment_type
```

**refunds.csv:**

```
refund_id,transaction_id,refund_amount,refund_date
```

**payouts.csv:**

```
payout_date,processor_fees,net_payout
```

**products.csv:**

```
product_id,product_name,cogs
```

## Deployment

### Frontend (Vercel - Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set environment variables in Vercel dashboard:

- `ANTHROPIC_API_KEY`
- `PYTHON_AI_URL` (your production Python service URL)

### Python Service (Railway, Render, or AWS)

1. Add `Procfile`:

```
web: cd python-service && uvicorn main:app --host 0.0.0.0 --port $PORT
```

2. Set environment variable:

- `ANTHROPIC_API_KEY`

3. Deploy and update `PYTHON_AI_URL` in your Next.js deployment

## Troubleshooting

### "Claude AI: Inactive" message

- Check that `ANTHROPIC_API_KEY` is set in `.env.local`
- Restart both dev servers after adding the key
- Verify the Python service is running at http://localhost:8001/health

### CSV Upload Fails

- Check file has correct column names (case-sensitive)
- Ensure CSV is properly formatted (no extra commas, quotes balanced)
- Check browser console and terminal for specific error messages

### Layout Issues / Styles Not Working

- Ensure `tailwind.config.ts` exists in project root
- Run `rm -rf .next && npm run dev` to clear cache
- Hard refresh browser with `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### TypeScript Errors

- Run `npx tsc --noEmit` to check for type errors
- Restart TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

### Python Service Won't Start

- Check virtual environment is activated
- Verify all dependencies installed: `pip list`
- Check port 8001 isn't already in use: `lsof -i :8001`

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly (both frontend and Python service)
4. Commit: `git commit -m "Description of changes"`
5. Push: `git push origin feature/your-feature-name`
6. Open a Pull Request on GitHub

## Architecture Decisions

### Why Next.js 14 with App Router?

- Server Components reduce JavaScript sent to browser
- Built-in API routes eliminate need for separate backend
- File-based routing simplifies project structure
- Excellent TypeScript support

### Why Separate Python Service?

- Leverages existing Python data analysis code
- Claude AI SDK more mature in Python
- Pandas better for CSV processing than JavaScript alternatives
- Allows independent scaling of AI service

### Why TypeScript?

- Type safety prevents runtime errors
- Better IDE autocomplete and documentation
- Shared types between frontend and backend
- Easier refactoring as project grows

### Why Tailwind CSS?

- Utility-first approach speeds up development
- No CSS file management needed
- Responsive design built-in
- Excellent with component-based architecture

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:

- Open an issue on GitHub
- Check existing issues for solutions
- Review this README's troubleshooting section

---

**Built for coffee shops and restaurants that want AI-powered insights into their cash flow.**
