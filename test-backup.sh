#!/bin/bash

# Test script for OpenAI API Worker
# Usage: ./test.sh [worker-url] [api-key]

WORKER_URL=${1:-"https://openai-api-worker.hacolby.workers.dev"}
API_KEY=${2:-"6502241638"}

echo "🧪 Testing OpenAI API Worker at: $WORKER_URL"
echo "🔑 Using Worker API Key: $API_KEY"
echo ""

# Test landing page
echo "🧪 === Testing Static Assets ===="
curl -s "$WORKER_URL/" -o /tmp/landing.html
if [ $? -eq 0 ]; then
    echo "✅ Landing page loaded successfully"
    echo "📄 Content size: $(wc -c < /tmp/landing.html) bytes"
else
    echo "❌ Landing page failed to load"
fi
echo ""

# Test OpenAPI spec
echo "=== 📋 OpenAPI Specification ==="
curl -s "$WORKER_URL/openapi.json" | head -10
echo "..."
echo ""

# Test health endpoint
echo "=== ❤️  Health Check ==="
curl -s "$WORKER_URL/health" | jq .
echo ""

# Test models endpoint
echo "=== 🤖 List Models ==="
curl -s -H "Authorization: Bearer $API_KEY" "$WORKER_URL/v1/models" | jq '.data | length' 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Models endpoint working"
else
    echo "❌ Models endpoint failed"
fi
echo ""

# Test chat completions (non-streaming)
echo "=== 💬 Chat Completion (Non-streaming) ==="
RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Say hello and tell me what model you are in exactly 10 words"}
    ],
    "max_tokens": 50,
    "temperature": 0.7
  }')

if echo "$RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Chat completion successful"
    echo "🤖 Response: $(echo "$RESPONSE" | jq -r '.choices[0].message.content')"
else
    echo "❌ Chat completion failed"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
fi
echo ""

# Test streaming
echo "=== 🌊 Chat Completion (Streaming) ==="
echo "Starting stream test..."
timeout 10 curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Count from 1 to 3"}
    ],
    "stream": true,
    "max_tokens": 30
  }' | head -20

echo ""
echo ""

# Test with different model
echo "=== 🔄 Test Backup Model ==="
BACKUP_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "max_tokens": 20
  }')

if echo "$BACKUP_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Backup model working"
    echo "🤖 Response: $(echo "$BACKUP_RESPONSE" | jq -r '.choices[0].message.content')"
else
    echo "❌ Backup model failed"
    echo "$BACKUP_RESPONSE" | jq . 2>/dev/null || echo "$BACKUP_RESPONSE"
fi
echo ""

# Test legacy completions endpoint
echo "=== 📝 Legacy Completions ==="
LEGACY_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "prompt": "The capital of France is",
    "max_tokens": 10
  }')

if echo "$LEGACY_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Legacy completions working"
    echo "🤖 Response: $(echo "$LEGACY_RESPONSE" | jq -r '.choices[0].message.content')"
else
    echo "❌ Legacy completions failed"
    echo "$LEGACY_RESPONSE" | jq . 2>/dev/null || echo "$LEGACY_RESPONSE"
fi
echo ""

# Test authentication
echo "=== 🔒 Authentication Test ==="
AUTH_TEST=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "test"}]
  }')

if echo "$AUTH_TEST" | jq -e '.error.message' | grep -q "Missing Authorization"; then
    echo "✅ Authentication properly enforced"
else
    echo "⚠️  Authentication test unexpected result"
    echo "$AUTH_TEST" | jq . 2>/dev/null || echo "$AUTH_TEST"
fi
echo ""

# Test 404 handling
echo "=== 🚫 404 Handling ==="
NOT_FOUND=$(curl -s "$WORKER_URL/nonexistent" -H "Authorization: Bearer $API_KEY")
if echo "$NOT_FOUND" | jq -e '.error.message' | grep -q "Not found"; then
    echo "✅ 404 handling working"
else
    echo "⚠️  404 handling unexpected result"
fi
echo ""

echo "🎉 === Test Summary Complete ==="
echo ""
echo "📍 Worker URL: $WORKER_URL"
echo "🌐 Landing Page: $WORKER_URL/"
echo "📋 OpenAPI Spec: $WORKER_URL/openapi.json"
echo "❤️  Health Check: $WORKER_URL/health"
echo ""
echo "🚀 Ready to use! Try opening $WORKER_URL in your browser."
