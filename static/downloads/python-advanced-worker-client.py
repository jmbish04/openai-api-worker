#!/usr/bin/env python3
"""Advanced Worker AI client featuring file and SQLite helpers."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests

DEFAULT_WORKER_URL = "https://your-worker-url.example.com"
ENV_PATH = Path(__file__).resolve().parent / ".env"


class WorkerAIClient:
    """A high-level client for interacting with the OpenAI-compatible worker."""

    def __init__(self, model: str = "@cf/openai/gpt-oss-120b") -> None:
        self.model = model
        self.env_values = self.load_env()
        self.worker_url = self.env_values.get("WORKER_URL", DEFAULT_WORKER_URL).rstrip("/")
        self.api_key = self.env_values.get("WORKER_API_KEY")
        self.system_instruction: str = "You are a pragmatic assistant."

    @staticmethod
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

    @classmethod
    def load_env(cls, path: Path = ENV_PATH) -> Dict[str, str]:
        cls.ensure_env_file(path)
        values: Dict[str, str] = {}

        for line in path.read_text(encoding="utf-8").splitlines():
            if not line or line.strip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            cleaned = value.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), cleaned)
            values[key.strip()] = cleaned

        return values

    def require_api_key(self) -> None:
        if not self.api_key:
            raise RuntimeError(
                "WORKER_API_KEY is missing. Update the .env file next to this script with your secret."
            )

    def set_system_instruction_from_file(self, path: str) -> None:
        content = Path(path).read_text(encoding="utf-8")
        self.system_instruction = content.strip() or self.system_instruction

    def call_model(self, messages: List[Dict[str, Any]], **options: Any) -> Dict[str, Any]:
        self.require_api_key()
        endpoint = f"{self.worker_url}/v1/chat/completions"
        payload = {"model": options.pop("model", self.model), "messages": messages}
        payload.update(options)

        response = requests.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        return response.json()

    def ask(self, prompt: str, **options: Any) -> str:
        messages = [
            {"role": "system", "content": self.system_instruction},
            {"role": "user", "content": prompt},
        ]
        result = self.call_model(messages, **options)
        return self._extract_content(result)

    def structured_llama4(self, prompt: str) -> Dict[str, Any]:
        schema = {
            "type": "object",
            "properties": {
                "topic": {"type": "string"},
                "key_points": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 3,
                },
                "next_step": {"type": "string"},
            },
            "required": ["topic", "key_points", "next_step"],
            "additionalProperties": False,
        }

        messages = [
            {"role": "system", "content": "You return JSON strictly following the schema."},
            {"role": "user", "content": prompt},
        ]
        result = self.call_model(
            messages,
            model="@cf/meta/llama-4-scout-17b-16e-instruct",
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "insight_packet",
                    "schema": schema,
                },
            },
        )
        message = result.get("choices", [{}])[0].get("message", {})
        structured = message.get("parsed") or message.get("content") or {}
        if isinstance(structured, str):
            try:
                structured = json.loads(self.strip_code_fences(structured))
            except json.JSONDecodeError:
                structured = {"raw": structured}
        return structured

    @staticmethod
    def strip_code_fences(text: str) -> str:
        if not text:
            return ""
        cleaned = text.strip()
        for fence in ("```", "~~~"):
            if cleaned.startswith(fence) and cleaned.endswith(fence):
                inner = cleaned[len(fence):-len(fence)].strip()
                if "\n" in inner:
                    language, body = inner.split("\n", 1)
                    if language.strip() and not body.strip():
                        cleaned = language
                    else:
                        cleaned = body
                else:
                    cleaned = inner
                break
        return cleaned.strip()

    def read_local_file(self, path: str) -> str:
        return Path(path).read_text(encoding="utf-8")

    def save_local_file(self, path: str, content: str) -> None:
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8")

    def read_sqlite(self, db_path: str, query: str, params: Optional[Iterable[Any]] = None) -> List[Dict[str, Any]]:
        connection = sqlite3.connect(db_path)
        connection.row_factory = sqlite3.Row
        try:
            cursor = connection.execute(query, params or [])
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            connection.close()

    def append_sqlite(self, db_path: str, table: str, data: Dict[str, Any]) -> None:
        connection = sqlite3.connect(db_path)
        try:
            columns = ", ".join(data.keys())
            placeholders = ", ".join(["?"] * len(data))
            connection.execute(
                f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
                tuple(data.values()),
            )
            connection.commit()
        finally:
            connection.close()

    def _extract_content(self, response: Dict[str, Any]) -> str:
        message = response.get("choices", [{}])[0].get("message", {})
        content = message.get("content")
        if isinstance(content, str):
            return self.strip_code_fences(content)
        return json.dumps(message, indent=2)


def demo() -> None:
    client = WorkerAIClient()
    try:
        summary = client.ask("List two benefits of edge inference.")
        print("Chat completion:\n", summary)

        structured = client.structured_llama4("Share deployment insights for Workers AI.")
        print("\nStructured response:\n", json.dumps(structured, indent=2))

        client.save_local_file("./artifacts/notes.txt", "Edge inference keeps latency low.\n")
        print("\nSaved notes to ./artifacts/notes.txt")

    except RuntimeError as error:
        print(error)


if __name__ == "__main__":
    demo()
