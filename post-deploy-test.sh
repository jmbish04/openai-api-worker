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
MODELS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$WORKER_URL/v1/models")
MODEL_COUNT=$(echo "$MODELS_RESPONSE" | jq '.data | length' 2>/dev/null)

if [ $? -eq 0 ] && [ "$MODEL_COUNT" -gt 0 ]; then
    echo "✅ Models endpoint working"
    echo "📊 Found $MODEL_COUNT models"
    
    # Check for core API integration
    echo ""
    echo "=== 🔗 Core API Integration Test ==="
    
    # Check if we have more than the basic fallback models (7)
    if [ "$MODEL_COUNT" -gt 7 ]; then
        echo "✅ Core API integration working - discovered $MODEL_COUNT models"
        
        # Check for model descriptions (indicates core API data)
        DESCRIPTIONS=$(echo "$MODELS_RESPONSE" | jq -r '.data[] | select(.description != null) | .description' | wc -l)
        if [ "$DESCRIPTIONS" -gt 0 ]; then
            echo "✅ Model metadata enhanced with descriptions ($DESCRIPTIONS models)"
        fi
        
        # Show sample of discovered models
        echo "🔍 Sample discovered models:"
        echo "$MODELS_RESPONSE" | jq -r '.data[0:3] | .[] | "  • \(.id) (\(.owned_by))"' 2>/dev/null
        
    else
        echo "⚠️  Using fallback models ($MODEL_COUNT) - Core API may be unavailable"
        
        # Show fallback models
        echo "🔄 Fallback models in use:"
        echo "$MODELS_RESPONSE" | jq -r '.data[] | "  • \(.id) (\(.owned_by))"' 2>/dev/null
    fi
    
    # Test specific model categories
    echo ""
    echo "📋 Model Categories:"
    CLOUDFLARE_MODELS=$(echo "$MODELS_RESPONSE" | jq -r '.data[] | select(.owned_by == "cloudflare") | .id' | wc -l)
    PROXY_MODELS=$(echo "$MODELS_RESPONSE" | jq -r '.data[] | select(.owned_by == "cloudflare-proxy") | .id' | wc -l)
    
    echo "  🏭 Cloudflare models: $CLOUDFLARE_MODELS"
    echo "  🔄 Proxy models: $PROXY_MODELS"
    
else
    echo "❌ Models endpoint failed"
    echo "$MODELS_RESPONSE" | jq . 2>/dev/null || echo "$MODELS_RESPONSE"
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

# Test memory-enabled completions endpoint
echo "=== 🧠 Memory-Enabled Completions ==="
MEMORY_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/completions/withmemory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "prompt": "My name is Alice. Remember this.",
    "max_tokens": 20,
    "memory": true,
    "memory_keyword": "test-session-123"
  }')

if echo "$MEMORY_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Memory-enabled completions working"
    echo "🤖 Response: $(echo "$MEMORY_RESPONSE" | jq -r '.choices[0].message.content')"
    
    # Test follow-up with memory
    echo ""
    echo "=== 🧠 Memory Follow-up Test ==="
    MEMORY_FOLLOWUP=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $API_KEY" \
      -d '{
        "model": "gpt-3.5-turbo",
        "messages": [
          {"role": "user", "content": "What is my name?"}
        ],
        "max_tokens": 20,
        "memory": true,
        "memory_keyword": "test-session-123"
      }')
    
    if echo "$MEMORY_FOLLOWUP" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
        echo "✅ Memory follow-up working"
        echo "🤖 Response: $(echo "$MEMORY_FOLLOWUP" | jq -r '.choices[0].message.content')"
    else
        echo "❌ Memory follow-up failed"
        echo "$MEMORY_FOLLOWUP" | jq . 2>/dev/null || echo "$MEMORY_FOLLOWUP"
    fi
else
    echo "❌ Memory-enabled completions failed"
    echo "$MEMORY_RESPONSE" | jq . 2>/dev/null || echo "$MEMORY_RESPONSE"
fi
echo ""

# Test structured completions endpoint
echo "=== 📋 Structured Completions ==="
STRUCTURED_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions/structured" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Tell me about a person with name, age, and city"}
    ],
    "max_tokens": 100,
    "response_format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "age": {"type": "number"},
          "city": {"type": "string"}
        },
        "required": ["name", "age", "city"]
      }
    }
  }')

if echo "$STRUCTURED_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Structured completions working"
    echo "🤖 Response: $(echo "$STRUCTURED_RESPONSE" | jq -r '.choices[0].message.content')"
else
    echo "❌ Structured completions failed"
    echo "$STRUCTURED_RESPONSE" | jq . 2>/dev/null || echo "$STRUCTURED_RESPONSE"
fi
echo ""

# Test text-only completions endpoint
echo "=== 📝 Text-Only Completions ==="
TEXT_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions/text" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Say hello in exactly 3 words"}
    ],
    "max_tokens": 10
  }')

if echo "$TEXT_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Text-only completions working"
    echo "🤖 Response: $(echo "$TEXT_RESPONSE" | jq -r '.choices[0].message.content')"
else
    echo "❌ Text-only completions failed"
    echo "$TEXT_RESPONSE" | jq . 2>/dev/null || echo "$TEXT_RESPONSE"
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

# Test error handling for memory endpoints
echo "=== 🚫 Memory Error Handling ==="
MEMORY_ERROR=$(curl -s -X POST "$WORKER_URL/v1/completions/withmemory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "prompt": "Test without memory flag",
    "max_tokens": 10
  }')

if echo "$MEMORY_ERROR" | jq -e '.error.message' | grep -q "memory.*must be set to true"; then
    echo "✅ Memory validation working"
else
    echo "⚠️  Memory validation unexpected result"
    echo "$MEMORY_ERROR" | jq . 2>/dev/null || echo "$MEMORY_ERROR"
fi
echo ""

# Test different model providers
echo "=== 🔄 Multi-Provider Model Testing ==="

# Test Cloudflare models
echo "Testing Cloudflare models..."
CLOUDFLARE_MODELS=$(echo "$MODELS_RESPONSE" | jq -r '.data[] | select(.id | startswith("@cf/")) | .id' | head -3)
if [ -n "$CLOUDFLARE_MODELS" ]; then
    echo "Found Cloudflare models:"
    echo "$CLOUDFLARE_MODELS" | while read -r model; do
        echo "  • $model"
    done
    
    # Test one Cloudflare model
    CF_MODEL=$(echo "$CLOUDFLARE_MODELS" | head -1)
    if [ -n "$CF_MODEL" ]; then
        echo "Testing Cloudflare model: $CF_MODEL"
        CF_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $API_KEY" \
          -d "{
            \"model\": \"$CF_MODEL\",
            \"messages\": [
              {\"role\": \"user\", \"content\": \"Say hello in 5 words\"}
            ],
            \"max_tokens\": 20
          }")
        
        if echo "$CF_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
            echo "✅ Cloudflare model working: $CF_MODEL"
        else
            echo "❌ Cloudflare model failed: $CF_MODEL"
        fi
    fi
else
    echo "⚠️  No Cloudflare models found"
fi
echo ""

# Test API endpoints discovery
echo "=== 🔍 API Endpoints Discovery ==="
echo "Available endpoints:"
echo "  • GET  /health - Health check"
echo "  • GET  /v1/models - List models"
echo "  • POST /v1/chat/completions - Chat completions"
echo "  • POST /v1/chat/completions/structured - Structured completions"
echo "  • POST /v1/chat/completions/text - Text-only completions"
echo "  • POST /v1/completions - Legacy completions"
echo "  • POST /v1/completions/withmemory - Memory-enabled completions"
echo "  • GET  /openapi.json - OpenAPI specification"
echo "  • GET  / - Landing page"
echo ""

# Test rate limiting and performance
echo "=== ⚡ Performance Test ==="
echo "Testing response times..."
START_TIME=$(date +%s%3N)
PERF_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hi"}
    ],
    "max_tokens": 5
  }')
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

if echo "$PERF_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    echo "✅ Performance test successful"
    echo "⏱️  Response time: ${RESPONSE_TIME}ms"
    if [ $RESPONSE_TIME -lt 5000 ]; then
        echo "✅ Response time is acceptable (< 5s)"
    else
        echo "⚠️  Response time is slow (> 5s)"
    fi
else
    echo "❌ Performance test failed"
fi
echo ""

echo "🎉 === Comprehensive Test Summary Complete ==="
echo ""
echo "📍 Worker URL: $WORKER_URL"
echo "🌐 Landing Page: $WORKER_URL/"
echo "📋 OpenAPI Spec: $WORKER_URL/openapi.json"
echo "❤️  Health Check: $WORKER_URL/health"
echo ""

# Core API Integration Summary
echo "=== 🔗 Core API Integration Summary ==="
if [ "$MODEL_COUNT" -gt 7 ]; then
    echo "✅ Core API integration: ACTIVE"
    echo "📊 Dynamic model discovery: $MODEL_COUNT models available"
    echo "📋 Enhanced metadata: Available"
else
    echo "🟡 Core API integration: FALLBACK MODE"
    echo "📊 Static model list: $MODEL_COUNT models"
    echo "⚠️  Core API may be unavailable or authentication failed"
fi
echo ""

# Feature Summary
echo "=== 🚀 Feature Summary ==="
echo "✅ Core Features:"
echo "  • OpenAI-compatible API"
echo "  • Multi-provider support (OpenAI, Gemini, Cloudflare)"
echo "  • Streaming and non-streaming responses"
echo "  • Memory-enabled conversations"
echo "  • Structured JSON responses"
echo "  • Legacy completions support"
echo "  • Comprehensive error handling"
echo "  • CORS support"
echo "  • Authentication"
echo ""

echo "🔧 Available Endpoints:"
echo "  • GET  /health - Health check"
echo "  • GET  /v1/models - List all available models"
echo "  • POST /v1/chat/completions - Standard chat completions"
echo "  • POST /v1/chat/completions/structured - JSON schema responses"
echo "  • POST /v1/chat/completions/text - Text-only responses"
echo "  • POST /v1/completions - Legacy prompt-based completions"
echo "  • POST /v1/completions/withmemory - Memory-enabled completions"
echo "  • GET  /openapi.json - OpenAPI 3.0 specification"
echo "  • GET  / - Interactive landing page"
echo ""

echo "🧠 Memory Features:"
echo "  • KV-based conversation memory"
echo "  • Keyword-based memory isolation"
echo "  • Cross-request context persistence"
echo "  • Memory validation and error handling"
echo ""

echo "🔄 Model Providers:"
echo "  • OpenAI: GPT models with full API compatibility"
echo "  • Google Gemini: Advanced reasoning models"
echo "  • Cloudflare AI: Edge-optimized models"
echo "  • Dynamic model discovery via Core API"
echo ""

echo "🚀 Ready to use! Try opening $WORKER_URL in your browser."
echo "📖 Check the OpenAPI spec at $WORKER_URL/openapi.json for detailed documentation."
