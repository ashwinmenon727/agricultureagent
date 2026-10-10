# AgriGuide — AI Farm Intelligence

AgriGuide is a local-first agricultural decision-support dashboard with an AI farm copilot. The redesigned interface brings farm profiles, live weather, crop-health signals, seasonal planning, soil records, market information, finance, and the farm journal into one responsive workspace.

## What is included

- **AI farm copilot** with Simple and Expert response modes
- **Persistent field profiles** so chat can use the active crop, area, soil, planting date, and irrigation method
- **Live weather + agricultural alerts** using Open-Meteo
- **Crop-health signal** derived from current/forecast weather
- **Market panel** with live/reference source labelling
- **Seasonal crop calendar** with month-level guidance
- **Soil test history** and broad reference amendment guidance
- **Farm finance** for input costs, yield, revenue, and profit/loss
- **Farm journal** with photos and CSV export
- **Voice input + read aloud** where the browser supports speech APIs
- **Low-data/offline mode** with local FAQ knowledge and an installable PWA shell
- **31 UI languages** included in `frontend/locales/`
- Responsive desktop, tablet, and mobile layouts with light/dark theme support

## Quick start

### Windows

```powershell
cd agri-agent\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### macOS / Linux

```bash
cd agri-agent/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000`.

## AI configuration

The application works without an AI key for local FAQs and deterministic/local features. For open-ended AI replies, copy `backend/.env.example` to `backend/.env` and set your own OpenAI or OpenAI-compatible provider values:

```env
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Never commit `backend/.env`. The distributable project intentionally excludes secrets.

## Recommended first-run flow

1. Pick a language.
2. Set the farm location by search or GPS.
3. Add at least one field and mark the one you are working on as active.
4. Review the Overview and Live Intelligence cards.
5. Ask the AI a decision question such as “Should I irrigate my active field tomorrow?”
6. Log real soil-test values, field activities, and seasonal finances as work happens.
7. Use the Crop Calendar as month-level planning guidance, then adapt exact timing to the crop stage, local weather, and agronomy advice.

See [`WORKFLOW.md`](WORKFLOW.md) for the complete user and technical workflow.

## Data and decision boundaries

AgriGuide distinguishes live data, reference data, local records, and AI-generated explanations. Weather and market information can fail or become stale; the interface exposes source/failure states instead of silently inventing values. Soil amendment guidance is broad reference information and should be checked against a laboratory soil test, product label, crop requirement, and qualified local agronomy guidance before application.

## Project structure

```text
agri-agent/
├── backend/
│   ├── main.py                 FastAPI API + static frontend host
│   ├── agent/
│   │   ├── chat.py             Routing, offline fallback, AI call
│   │   └── prompts.py          Guarded system/farm-context prompt
│   ├── services/
│   │   ├── weather.py          Weather integration
│   │   ├── market.py           Market/reference rates
│   │   ├── crop_health.py      Weather-based farm-health signal
│   │   └── geocode.py          Location search/reverse geocoding
│   └── data/                   Crops, FAQs, reference market data
├── frontend/
│   ├── index.html              Main application
│   ├── css/style.css           Responsive UI system
│   ├── js/
│   │   ├── farm.js             Field profiles + active context
│   │   ├── chat.js             Chat API client
│   │   ├── dashboard.js        Overview/crop-health rendering
│   │   ├── live.js             Weather + market orchestration
│   │   ├── calendar.js         Seasonal planning
│   │   ├── soil.js             Soil records
│   │   ├── finance.js          Farm economics
│   │   ├── journal.js          Activity log + CSV export
│   │   └── ...
│   ├── locales/                UI translations
│   ├── manifest.json           PWA metadata
│   └── sw.js                   Offline shell cache
├── scripts/smoke_test.py       No-network API smoke checks
└── WORKFLOW.md
```

## Verification

From the project root, after installing backend requirements:

```bash
python scripts/smoke_test.py
python -m compileall -q backend
```

If Node.js is installed, JavaScript syntax can also be checked with:

```bash
node --check frontend/js/app.js
node --check frontend/sw.js
```

## Production checklist

Before commercial deployment, use HTTPS, a managed secret store, authenticated user accounts, server-side persistent storage, backups, audit logs, rate limiting, monitoring/error tracking, provider quotas, a privacy policy, and region-specific agronomic/legal review. The current version is a strong working product foundation, not a substitute for those production controls.
