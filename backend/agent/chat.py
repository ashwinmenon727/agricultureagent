import json
import logging
import os
import re
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

from agent.prompts import build_system_prompt
from services.market import format_market_context, get_market_rates
from services.weather import format_weather_context, get_live_weather

FAQ_DIR = Path(__file__).resolve().parent.parent / "data" / "faqs"


class LLMUnavailableError(RuntimeError):
    """Raised when an AI provider is configured but cannot return a reply."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code

WEATHER_KEYWORDS = re.compile(
    r"weather|rain|monsoon|irrigation|water|flood|landslide|storm|heat|drought|"
    r"barish|paani|pani|sinchai|mazhai|brishti|sech|台风|雨|天気|날씨|비",
    re.I,
)
MARKET_KEYWORDS = re.compile(
    r"price|rate|cost|mandi|market|msp|fertilizer|fertiliser|pesticide|urea|dap|"
    r"daam|bhav|dam|rate|मूल्य|விலை|দাম|价格|価格|가격|harga",
    re.I,
)
DECISION_KEYWORDS = re.compile(
    r"should\s+i|what\s+should|recommend|plan|today|tomorrow|spray|sow|plant|"
    r"harvest|transplant|farm task|field work|crop care|advice|schedule",
    re.I,
)
GREETING_KEYWORDS = re.compile(
    r"^(hi|hello|hey|namaste|namaskar|vanakkam|নমস্কার|你好|こんにちは|안녕)\b[!.?\s]*$",
    re.I,
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _is_greeting(message: str) -> bool:
    return bool(GREETING_KEYWORDS.search(_normalize(message)))


def _keyword_matches(query: str, keyword: str) -> bool:
    normalized_keyword = _normalize(keyword)
    if not normalized_keyword:
        return False

    if re.fullmatch(r"[a-z0-9][a-z0-9\s-]*", normalized_keyword):
        return bool(re.search(rf"(?<![a-z0-9]){re.escape(normalized_keyword)}(?![a-z0-9])", query))

    return normalized_keyword in query


def _load_faqs(language: str) -> list[dict]:
    path = FAQ_DIR / f"{language}.json"
    if not path.exists():
        path = FAQ_DIR / "en.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def match_offline_faq(message: str, language: str) -> str | None:
    query = _normalize(message)
    if not query:
        return None

    best_score = 0
    best_answer = None

    for faq in _load_faqs(language):
        keywords = faq.get("keywords", [])
        score = sum(1 for kw in keywords if _keyword_matches(query, kw))
        if score > best_score:
            best_score = score
            best_answer = faq.get("answer")

    if best_score >= 1 and best_answer:
        return best_answer
    return None


async def _build_live_context(
    message: str,
    latitude: float | None,
    longitude: float | None,
    elevation: float | None,
    location_label: str,
    country_code: str,
) -> str:
    parts = []
    wants_weather = bool(WEATHER_KEYWORDS.search(message) or DECISION_KEYWORDS.search(message))
    wants_market = bool(MARKET_KEYWORDS.search(message))

    if not wants_weather and not wants_market:
        return ""

    if latitude is not None and longitude is not None and wants_weather:
        try:
            weather = await get_live_weather(
                latitude, longitude, elevation=elevation, location_label=location_label
            )
            parts.append(format_weather_context(weather))
        except Exception as exc:
            logger.warning("Weather fetch failed: %s", exc)

    if wants_market:
        try:
            rates = await get_market_rates(country_code=country_code)
            parts.append(format_market_context(rates))
        except Exception as exc:
            logger.warning("Market fetch failed: %s", exc)

    return "\n\n".join(p for p in parts if p)


def _format_live_fallback(live_context: str, language: str) -> str | None:
    if not live_context:
        return None
    headers = {
        "en": "Here is live data for your area:",
        "hi": "आपके क्षेत्र का live डेटा:",
        "ta": "உங்கள் பகுதியின் live தரவு:",
        "bn": "আপনার এলাকার live তথ্য:",
        "zh": "您地区的实时数据：",
    }
    return headers.get(language, headers["en"]) + "\n\n" + live_context


async def call_llm(
    message: str,
    language: str,
    mode: str,
    history: list[dict],
    live_context: str = "",
    farm_context: dict | None = None,
) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    try:
        max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "1200"))
    except (TypeError, ValueError):
        max_tokens = 1200

    messages = [
        {"role": "system", "content": build_system_prompt(language, mode, live_context, farm_context)},
    ]
    for item in history[-8:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = str(item.get("content", "")).strip()[:4000]
        # Only allow conversational roles from client history. System/tool roles
        # are controlled by the server to prevent prompt-role injection.
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.4,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = _extract_llm_error_detail(exc.response)
            raise LLMUnavailableError(detail, exc.response.status_code) from exc
        except httpx.HTTPError as exc:
            raise LLMUnavailableError(str(exc)) from exc

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise LLMUnavailableError("AI provider returned an unexpected response format") from None
        return content.strip() if content else None


def _extract_llm_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text[:500] or response.reason_phrase

    if isinstance(payload, list) and payload:
        payload = payload[0]

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error.get("status") or payload)[:1000]
        return str(payload)[:1000]
    return str(payload)[:1000]


def _has_llm_config() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def ai_unavailable_reply(language: str) -> str:
    messages = {
        "en": "AI replies are configured, but the AI provider is currently unavailable or over quota. Please check OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, and your provider billing/quota in backend/.env, then try again.",
        "hi": "AI जवाब configured हैं, लेकिन AI provider अभी unavailable है या quota खत्म हो गया है। कृपया backend/.env में OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL और provider billing/quota जांचें, फिर दोबारा कोशिश करें।",
        "ta": "AI பதில்கள் அமைக்கப்பட்டுள்ளன, ஆனால் AI provider தற்போது கிடைக்கவில்லை அல்லது quota முடிந்துள்ளது. backend/.env-ல் OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL மற்றும் provider billing/quota-வை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
        "bn": "AI উত্তর configured আছে, কিন্তু AI provider এখন unavailable অথবা quota শেষ। backend/.env-এ OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL এবং provider billing/quota পরীক্ষা করে আবার চেষ্টা করুন।",
        "zh": "AI 回复已配置，但 AI 提供商当前不可用或额度已用完。请检查 backend/.env 中的 OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_MODEL 以及服务商账单/额度后重试。",
    }
    return messages.get(language, messages["en"])


def fallback_reply(message: str, language: str, mode: str, live_context: str = "") -> str:
    live = _format_live_fallback(live_context, language)
    if live:
        return live

    faq = match_offline_faq(message, language)
    if faq:
        prefix = "" if mode == "simple" else "[Offline knowledge base]\n"
        return prefix + faq

    if _is_greeting(message):
        greetings = {
            "en": "Hi! I can help with crop care, pests, fertilizer, irrigation, weather, and market prices. What would you like to know?",
            "hi": "नमस्ते! मैं फसल, कीट, खाद, सिंचाई, मौसम और मंडी भाव में मदद कर सकता हूँ। आप क्या जानना चाहते हैं?",
            "ta": "வணக்கம்! பயிர் பராமரிப்பு, பூச்சி, உரம், பாசனம், வானிலை, சந்தை விலை பற்றி உதவ முடியும். என்ன தெரிந்து கொள்ள வேண்டும்?",
            "bn": "নমস্কার! আমি ফসল, পোকা, সার, সেচ, আবহাওয়া ও বাজারদর বিষয়ে সাহায্য করতে পারি। আপনি কী জানতে চান?",
            "zh": "你好！我可以帮助解答作物管理、病虫害、肥料、灌溉、天气和市场价格问题。你想了解什么？",
        }
        return greetings.get(language, greetings["en"])

    if _has_llm_config():
        return ai_unavailable_reply(language)

    simple_msgs = {
        "en": "I could not find a specific offline answer for that. Please ask a fuller farming question, for example: irrigation for rice, pest control, fertilizer use, weather, or market price. For AI answers to open-ended questions, set OPENAI_API_KEY in backend/.env.",
        "hi": "इसके लिए offline जवाब नहीं मिला। कृपया पूरा खेती से जुड़ा सवाल पूछें, जैसे धान की सिंचाई, कीट नियंत्रण, खाद, मौसम या मंडी भाव। खुले सवालों के AI जवाब के लिए backend/.env में OPENAI_API_KEY सेट करें।",
        "ta": "இதற்கு குறிப்பிட்ட offline பதில் கிடைக்கவில்லை. நெல் பாசனம், பூச்சி கட்டுப்பாடு, உரம், வானிலை அல்லது சந்தை விலை போன்ற முழு விவசாயக் கேள்வியை கேளுங்கள். திறந்த கேள்விகளுக்கு AI பதில்களுக்கு backend/.env-ல் OPENAI_API_KEY அமைக்கவும்.",
        "bn": "এর জন্য নির্দিষ্ট offline উত্তর পাওয়া যায়নি। ধানের সেচ, পোকা নিয়ন্ত্রণ, সার, আবহাওয়া বা বাজারদর মতো পূর্ণ কৃষি প্রশ্ন করুন। উন্মুক্ত প্রশ্নের AI উত্তরের জন্য backend/.env-এ OPENAI_API_KEY সেট করুন।",
        "zh": "没有找到对应的离线答案。请提出更完整的农业问题，例如水稻灌溉、病虫害防治、施肥、天气或市场价格。若要回答开放式问题，请在 backend/.env 中设置 OPENAI_API_KEY。",
    }
    return simple_msgs.get(language, simple_msgs["en"])


async def get_agent_reply(
    message: str,
    language: str,
    mode: str,
    history: list[dict],
    prefer_offline: bool = False,
    latitude: float | None = None,
    longitude: float | None = None,
    elevation: float | None = None,
    location_label: str = "",
    country_code: str = "IN",
    farm_context: dict | None = None,
) -> dict:
    # Low-data/offline mode must never trigger network calls to weather, market,
    # or the LLM provider. This keeps the user's preference predictable.
    if prefer_offline:
        offline = match_offline_faq(message, language)
        if offline:
            return {"reply": offline, "source": "offline_faq"}
        return {
            "reply": fallback_reply(message, language, mode, ""),
            "source": "fallback",
        }

    live_context = await _build_live_context(
        message, latitude, longitude, elevation, location_label, country_code
    )

    try:
        llm_reply = await call_llm(message, language, mode, history, live_context, farm_context)
        if llm_reply:
            return {"reply": llm_reply, "source": "ai"}
    except LLMUnavailableError as exc:
        logger.warning("LLM provider unavailable (%s): %s", exc.status_code, exc)
        offline = match_offline_faq(message, language)
        if offline:
            return {"reply": offline, "source": "offline_faq"}
        live = _format_live_fallback(live_context, language)
        if live:
            return {"reply": live, "source": "live_data"}
        return {"reply": ai_unavailable_reply(language), "source": "ai_unavailable"}
    except Exception as exc:
        logger.warning("LLM call failed: %s", exc)

    return {
        "reply": fallback_reply(message, language, mode, live_context),
        "source": "live_data" if live_context else "fallback",
    }
