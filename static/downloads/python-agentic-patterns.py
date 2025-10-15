#!/usr/bin/env python3
"""Demonstrate tool-augmented agentic patterns with the worker AI."""

from __future__ import annotations

import json
import os
import random
from pathlib import Path
from typing import Dict, List

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


def call_worker(messages: List[dict], tools: List[dict]) -> dict:
    env_values = load_env()
    worker_url = env_values.get("WORKER_URL", DEFAULT_WORKER_URL).rstrip("/")
    api_key = env_values.get("WORKER_API_KEY")

    if not api_key:
        raise RuntimeError("WORKER_API_KEY is missing. Set it inside .env next to this script.")

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
            "tools": tools,
        },
        timeout=90,
    )
    response.raise_for_status()
    return response.json()


def mock_weather(city: str) -> Dict[str, str]:
    temperatures = random.randint(18, 32)
    return {
        "city": city,
        "temperature_c": temperatures,
        "condition": random.choice(["sunny", "cloudy", "rain showers"]),
    }


def mock_document_search(query: str) -> Dict[str, List[str]]:
    return {
        "query": query,
        "results": [
            "Workers AI supports OpenAI-compatible APIs at the edge.",
            "Structured responses provide JSON with schema guarantees.",
        ],
    }


def run_agentic_demo() -> None:
    messages: List[dict] = [
        {
            "role": "system",
            "content": "You are a research assistant that plans tasks and uses tools before answering.",
        },
        {
            "role": "user",
            "content": "Plan a weekend in Porto with a quick weather check and relevant reading list.",
        },
    ]

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Retrieve the current weather outlook for a city.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string"},
                    },
                    "required": ["city"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_docs",
                "description": "Search internal docs for planning context.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                    },
                    "required": ["query"],
                },
            },
        },
    ]

    while True:
        response = call_worker(messages, tools)
        message = response.get("choices", [{}])[0].get("message", {})
        tool_calls = message.get("tool_calls", [])

        if not tool_calls:
            print("\nFinal assistant response:\n")
            print(message.get("content", "No content returned."))
            break

        for call in tool_calls:
            name = call.get("function", {}).get("name")
            arguments = call.get("function", {}).get("arguments", "{}")
            tool_call_id = call.get("id") or "call-0"

            try:
                parsed_args = json.loads(arguments)
            except json.JSONDecodeError:
                parsed_args = {}

            if name == "get_weather":
                result = mock_weather(parsed_args.get("city", "Unknown"))
            elif name == "search_docs":
                result = mock_document_search(parsed_args.get("query", ""))
            else:
                result = {"error": f"Unhandled tool: {name}"}

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": json.dumps(result),
                }
            )


if __name__ == "__main__":
    run_agentic_demo()
