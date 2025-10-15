#!/usr/bin/env python3
"""Basic example: call the OpenAI-compatible worker for a friendly response."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict

import requests

DEFAULT_WORKER_URL = "https://your-worker-url.example.com"
ENV_PATH = Path(__file__).resolve().parent / ".env"


def ensure_env_file(path: Path = ENV_PATH) -> None:
    """Ensure a .env file exists with WORKER_URL and WORKER_API_KEY keys."""
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

    if "WORKER_URL" not in existing_keys or "WORKER_API_KEY" not in existing_keys:
        with path.open("a", encoding="utf-8") as handle:
            if "WORKER_URL" not in existing_keys:
                handle.write(f"\nWORKER_URL={defaults['WORKER_URL']}")
            if "WORKER_API_KEY" not in existing_keys:
                handle.write("\nWORKER_API_KEY=")


def load_env(path: Path = ENV_PATH) -> Dict[str, str]:
    """Load the environment variables from the .env file."""
    ensure_env_file(path)
    values: Dict[str, str] = {}

    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)
        values[key.strip()] = value

    return values


def call_worker(messages: list[dict[str, str]]) -> dict:
    env_values = load_env()
    worker_url = env_values.get("WORKER_URL", DEFAULT_WORKER_URL).rstrip("/")
    api_key = env_values.get("WORKER_API_KEY")

    if not api_key:
        raise RuntimeError(
            "WORKER_API_KEY is missing. Update the .env file next to this script with your worker API key."
        )

    endpoint = f"{worker_url}/v1/chat/completions"
    response = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "@cf/meta/llama-4-scout-17b-16e-instruct",
            "messages": messages,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    messages = [
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user", "content": "Summarize what this worker can do in two sentences."},
    ]

    result = call_worker(messages)
    try:
        content = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        content = json.dumps(result, indent=2)

    print("Response from worker:\n")
    print(content)


if __name__ == "__main__":
    main()
