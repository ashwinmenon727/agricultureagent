# Vayal Redesign Notes

This build replaces the old hard-coded dashboard prototype with one integrated farm-intelligence workspace.

## UI / UX

- Premium neutral/green visual system with responsive desktop/tablet/mobile layouts
- Compact navigation and clear Overview, Fields, AI Assistant, Calendar, Soil, Live Intelligence, Finance, and Journal sections
- Removed hard-coded weather/moisture/property values from the old prototype
- Replaced empty chat-dominated layout with operational KPIs, farm context, and live-data states
- Added light/dark theme, improved focus states, loading states, error/empty states, source labels, and PWA icons
- Added persistent field profiles and active-field selection
- Added right-side context rail for active field, live snapshot, workflow, and privacy information

## AI agent

- Active field profile is sent as structured farm context with each chat request
- Weather is automatically considered for weather and farm-decision intents when a location is available
- Client history is server-filtered to user/assistant roles only
- Farm context is marked as untrusted data inside the system prompt
- Low-data/offline mode now makes no external weather, market, or LLM calls
- AI failure falls back to local FAQs/live context instead of breaking the UI

## Reliability / correctness

- Weather, market, and crop-health refresh independently via `Promise.allSettled`
- Crop-health nutrient weighting bug fixed
- Thunderstorm spray advice is evaluated before ordinary rain thresholds
- Calendar no longer pretends month-level seasonal activities occur on every exact day
- Blank soil records and meaningless finance records are rejected
- Dynamic user/external text is escaped in journal/soil/finance/live panels
- Chat request length/mode/history validation tightened
- Service worker avoids silently caching live API responses
- Secrets removed from `.env.example`; the distributable build excludes `.env` and `.venv`

## QA performed

- Python bytecode compilation
- JavaScript syntax checks for every frontend module and service worker
- HTML duplicate-ID and JS-to-DOM ID contract check
- FastAPI smoke tests for health, crops, FAQs, frontend mount, offline chat, and request validation
- Secret-pattern scan on the clean distributable

A fully automated Chromium UI pass could not be run inside the build environment because local browser access is blocked by its sandbox policy. A manual browser pass is still recommended before public deployment.
