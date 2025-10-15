#!/usr/bin/env python3
"""Request a structured response from the worker using Llama 4 Scout."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, Tuple

import requests

DEFAULT_WORKER_URL = "https://your-worker-url.example.com"
ENV_PATH = Path(__file__).resolve().parent / ".env"


def ensure_env_file(path: Path = ENV_PATH) -> None:
    defaults: Dict[str, str] = {
        "WORKER_URL": DEFAULT_WORKER_URL,
        "WORKER_API_KEY": "",
    }

    if not path.exists():
        path.write_text(
            "# Environment settings for the OpenAI-compatible worker\n"
            "WORKER_URL={url}\n"
            "WORKER_API_KEY=\n".format(url=defaults["WORKER_URL"]),
            encoding="utf-8",
        )
        return

    existing_keys = {
        line.split("=", 1)[0].strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line and not line.strip().startswith("#") and "=" in line
    }

    with path.open("a", encoding="utf-8") as handle:
        if "WORKER_URL" not in existing_keys:
            handle.write(f"\nWORKER_URL={defaults['WORKER_URL']}")
        if "WORKER_API_KEY" not in existing_keys:
            handle.write("\nWORKER_API_KEY=")


def load_env(path: Path = ENV_PATH) -> Dict[str, str]:
    ensure_env_file(path)
    values: Dict[str, str] = {}

    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        clean_value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), clean_value)
        values[key.strip()] = clean_value

    return values


def build_payload(city: str) -> Tuple[str, dict]:
    schema = {
        "type": "object",
        "properties": {
            "city": {"type": "string"},
            "summary": {"type": "string"},
            "highlights": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
            },
            "best_season": {"type": "string"},
        },
        "required": ["city", "summary", "highlights", "best_season"],
        "additionalProperties": False,
    }

    payload = {
        "model": "@cf/meta/llama-4-scout-17b-16e-instruct",
        "messages": [
            {"role": "system", "content": "You are a travel data generator."},
            {
                "role": "user",
                "content": f"Create a JSON travel summary for {city}.",
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "travel_guide",
                "schema": schema,
            },
        },
    }
    return city, payload


def request_structured_response(city: str) -> dict:
    env_values = load_env()
    worker_url = env_values.get("WORKER_URL", DEFAULT_WORKER_URL).rstrip("/")
    api_key = env_values.get("WORKER_API_KEY")

    if not api_key:
        raise RuntimeError("WORKER_API_KEY is missing. Populate it inside .env next to this script.")

    _, payload = build_payload(city)
    endpoint = f"{worker_url}/v1/chat/completions"
    response = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    city = "Lisbon"
    result = request_structured_response(city)
    message = result.get("choices", [{}])[0].get("message", {})
    structured = message.get("parsed") or message.get("content")

    if isinstance(structured, str):
        try:
            structured = json.loads(structured)
        except json.JSONDecodeError:
            print("Raw response:\n", structured)
            return

    print(json.dumps(structured, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
