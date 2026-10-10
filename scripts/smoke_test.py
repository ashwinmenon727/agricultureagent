"""Fast, no-network smoke tests for AgriGuide.

Run from the project root after installing backend requirements:
    python scripts/smoke_test.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

# The offline chat path should never contact the configured AI provider.
os.environ["OPENAI_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    res = client.get("/api/health")
    expect(res.status_code == 200 and res.json().get("status") == "ok", "health endpoint failed")

    res = client.get("/api/crops")
    expect(res.status_code == 200, "crops endpoint failed")

    res = client.get("/api/faqs/en")
    expect(res.status_code == 200 and isinstance(res.json(), list), "FAQ endpoint failed")

    res = client.get("/")
    expect(res.status_code == 200 and "AgriGuide" in res.text, "frontend mount failed")

    res = client.post(
        "/api/chat",
        json={
            "message": "How should I irrigate rice?",
            "language": "en",
            "mode": "simple",
            "prefer_offline": True,
            "farm_context": {
                "active_field": {"name": "North", "crop": "Rice"},
                "fields": [{"id": "f1", "name": "North", "crop": "Rice"}],
            },
        },
    )
    expect(res.status_code == 200, f"offline chat failed: {res.text}")
    expect(res.json().get("source") in {"offline_faq", "fallback"}, "offline chat used unexpected source")

    # Reject an unsupported mode rather than silently accepting arbitrary client input.
    res = client.post("/api/chat", json={"message": "hello", "mode": "anything"})
    expect(res.status_code == 422, "chat mode validation failed")

    print("AgriGuide smoke tests: PASS")


if __name__ == "__main__":
    main()
