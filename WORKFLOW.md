# AgriGuide Workflow

## 1. Farmer workflow

```text
Open AgriGuide
      │
      ▼
Choose language
      │
      ▼
Set farm location ───────► Live weather / alerts / market context
      │
      ▼
Add field profile
(name, crop, area, soil, planting date, irrigation)
      │
      ▼
Mark one field ACTIVE
      │
      ├───────────────► Overview: crop-health + weather + alerts
      │
      ▼
Ask the AI farm copilot
      │
      ├─ Simple mode: short operational explanation
      └─ Expert mode: more detail, assumptions, and context
      │
      ▼
Review source + uncertainty
      │
      ▼
Take farm action only after checking local conditions / labels / agronomy
      │
      ├─ Log activity in Journal
      ├─ Add new soil-test result
      ├─ Update seasonal finance
      └─ Review month-level crop calendar
      │
      ▼
Next visit starts with stored field context and local records
```

### High-efficiency daily routine

**Morning:** set/check location, scan Overview, then use “Ask AI to summarize” for weather and market decisions. **Before a field operation:** make the correct field active and ask a specific question containing the planned action and timing. **After the operation:** record it in Journal, including cost/photos where useful. **When a lab/field soil test arrives:** enter the measured values rather than estimates. **At season end:** record costs, yield, and sale price so the Finance section shows the real margin.

## 2. AI request workflow

```text
User question
    │
    ▼
Frontend validates text
    │
    ├─ active field profile
    ├─ selected language / response mode
    ├─ selected location
    └─ last conversation messages
    │
    ▼
POST /api/chat
    │
    ├─ Low-data/offline requested?
    │      ├─ Yes → local FAQ/fallback only; no external AI/weather/market calls
    │      └─ No
    │
    ├─ Weather/decision intent? → fetch weather context when coordinates exist
    ├─ Market intent?           → fetch market context
    │
    ▼
Server creates guarded system prompt
    │
    ├─ farmer language
    ├─ Simple/Expert style
    ├─ live context
    └─ farm profile marked as untrusted data, not instructions
    │
    ▼
OpenAI-compatible model (when configured)
    │
    ├─ success → AI response
    └─ failure → FAQ / live-data fallback / clear unavailable state
    │
    ▼
Frontend renders reply + data-source label
```

## 3. Data-source workflow

| Data | Source | Persistence | Important behavior |
|---|---|---|---|
| Field profiles | Farmer input | Browser localStorage | Active field is sent as AI context only when chatting |
| Soil records | Farmer/lab input | Browser localStorage | Broad comparison ranges; no hidden fabricated measurements |
| Journal | Farmer input | Browser localStorage | CSV export available |
| Finance | Farmer input | Browser localStorage | Calculations are deterministic in-browser |
| Weather | Open-Meteo service | Memory/cache only | Not silently served as stale live data by service worker |
| Market | API/reference service | Memory/cache only | UI identifies live vs reference data |
| Crop-health signal | Deterministic weather-based calculation | Memory | A signal, not a sensor measurement |
| AI text | Configured model | Conversation memory in page | Falls back cleanly when provider is unavailable |

## 4. Failure workflow

AgriGuide is designed to degrade rather than collapse. If **weather fails**, market/other modules still render. If **market fails**, weather still renders. If **AI fails**, relevant local FAQ or live context is returned when possible. If the browser is **offline or Low Data is enabled**, chat avoids external AI/weather/market calls and uses local knowledge. Empty forms are validated so blank soil or finance records are not stored.

## 5. Commercialization workflow

For a production/commercial edition, add these layers around the current application:

```text
Authenticated farm account
        ↓
Cloud database + encrypted backups
        ↓
Per-field sensor / satellite / lab integrations
        ↓
Validated agronomic rule engine for dosage-critical recommendations
        ↓
AI explanation + tool orchestration
        ↓
Human-confirmed actions / tasks / audit trail
        ↓
Notifications, reports, team roles, billing, monitoring
```

Numerical input recommendations that affect chemical/fertilizer application should ultimately come from validated rule/data services and local regulations/product labels; the language model should explain those results rather than invent critical dosages.

## 6. QA workflow

Before each release:

```text
Python compile check
      ↓
JavaScript syntax check
      ↓
HTML ID/module contract check
      ↓
FastAPI smoke tests
      ↓
Secret scan / clean build
      ↓
Manual browser pass (desktop + mobile)
      ↓
Staging deployment
      ↓
Production
```

The repository includes `scripts/smoke_test.py` for fast no-network API checks.
