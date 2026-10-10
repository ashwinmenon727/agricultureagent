import json
import logging
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agent.chat import get_agent_reply
from services.crop_health import compute_crop_health, compute_forecast_agricultural_advice
from services.geocode import search_locations, reverse_geocode
from services.market import get_market_rates
from services.weather import get_live_weather

BACKEND_DIR = Path(__file__).resolve().parent
ROOT = BACKEND_DIR.parent

# Load backend/.env explicitly so OpenAI-compatible settings work whether the
# server is started from the repository root or from the backend directory.
load_dotenv(BACKEND_DIR / ".env")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

FRONTEND = ROOT / "frontend"
DATA = BACKEND_DIR / "data"

app = FastAPI(title="AgriGuide API", version="0.2.0")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:8000,http://localhost:8000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = Field(default="en", min_length=2, max_length=8, pattern=r"^[A-Za-z-]+$")
    mode: Literal["simple", "expert"] = "simple"
    history: list[dict] = Field(default_factory=list, max_length=24)
    prefer_offline: bool = False
    latitude: float | None = None
    longitude: float | None = None
    elevation: float | None = None
    location_label: str = Field(default="", max_length=240)
    country_code: str = Field(default="IN", min_length=2, max_length=3)
    farm_context: dict | None = None


class ChatResponse(BaseModel):
    reply: str
    source: str


@app.get("/api/health")
async def health():
    return {"status": "ok", "region": "Asia", "features": ["weather", "market", "alerts"]}


@app.get("/api/crops")
async def crops():
    with open(DATA / "crops_asia.json", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/faqs/{language}")
async def faqs(language: str):
    path = DATA / "faqs" / f"{language}.json"
    if not path.exists():
        path = DATA / "faqs" / "en.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/geocode/search")
async def geocode_search(
    q: str = Query(min_length=2),
    language: str = "en",
):
    return {"results": await search_locations(q, language=language)}


@app.get("/api/geocode/reverse")
async def geocode_reverse(lat: float, lon: float):
    result = await reverse_geocode(lat, lon)
    return result or {"country_code": None}


@app.get("/api/weather/live")
async def weather_live(
    lat: float,
    lon: float,
    elevation: float | None = None,
    label: str = "",
):
    return await get_live_weather(lat, lon, elevation=elevation, location_label=label)


@app.get("/api/crop-health")
async def crop_health(
    lat: float,
    lon: float,
    elevation: float | None = None,
    label: str = "",
):
    weather = await get_live_weather(lat, lon, elevation=elevation, location_label=label)
    health = compute_crop_health(weather)
    forecast_advice = compute_forecast_agricultural_advice(
        weather.get("forecast") or [],
        weather.get("current") or {},
    )
    return {
        "weather_source": weather.get("source"),
        "location": weather.get("location"),
        "health": health,
        "forecast": forecast_advice,
    }


@app.get("/api/market/rates")
async def market_rates(
    country: str = "IN",
    category: str = "all",
):
    return await get_market_rates(country_code=country, category=category)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    result = await get_agent_reply(
        message=body.message.strip(),
        language=body.language,
        mode=body.mode,
        history=body.history,
        prefer_offline=body.prefer_offline,
        latitude=body.latitude,
        longitude=body.longitude,
        elevation=body.elevation,
        location_label=body.location_label,
        country_code=body.country_code,
        farm_context=body.farm_context,
    )
    return result


if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")
