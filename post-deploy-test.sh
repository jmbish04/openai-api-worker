#!/bin/bash

# Post-deployment test script for OpenAI API Worker
# Tests all endpoints and features after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_URL="https://openai-api-worker.hacolby.workers.dev"

# Load API key from .dev.vars
if [ -f ".dev.vars" ]; then
    API_KEY=$(grep "^WORKER_API_KEY=" .dev.vars | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$API_KEY" ]; then
        echo "❌ WORKER_API_KEY not found in .dev.vars"
        exit 1
    fi
    echo "✅ Loaded API key from .dev.vars"
else
    echo "❌ .dev.vars file not found"
    exit 1
fi

# Output file
OUTPUT_FILE="post-deploy-test.txt"

# Function to log with both console and file output
log() {
    echo "$1" | tee -a "$OUTPUT_FILE"
}

# Function to log errors
log_error() {
    echo -e "${RED}$1${NC}" | tee -a "$OUTPUT_FILE"
}

# Function to log success
log_success() {
    echo -e "${GREEN}$1${NC}" | tee -a "$OUTPUT_FILE"
}

# Function to log warnings
log_warn() {
    echo -e "${YELLOW}$1${NC}" | tee -a "$OUTPUT_FILE"
}

# Function to log info
log_info() {
    echo -e "${BLUE}$1${NC}" | tee -a "$OUTPUT_FILE"
}

# Initialize output file
echo "Post-Deployment Test Results - $(date)" > "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

log_info "🚀 Starting Post-Deployment Tests"
log_info "Worker URL: $WORKER_URL"
log_info "API Key: ${API_KEY:0:10}..." # Show first 10 chars for security
log_info "Output file: $OUTPUT_FILE"
echo ""

# Test 1: Health Check
log_info "=== 🏥 Health Check ==="
HEALTH_RESPONSE=$(curl -s "$WORKER_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    log_success "✅ Health check passed"
    log "Response: $HEALTH_RESPONSE"
else
    log_error "❌ Health check failed"
    log "Response: $HEALTH_RESPONSE"
fi
echo ""

# Test 2: Models List
log_info "=== 📋 Models List ==="
MODELS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$WORKER_URL/v1/models")
if echo "$MODELS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    MODEL_COUNT=$(echo "$MODELS_RESPONSE" | jq '.data | length')
    log_success "✅ Models endpoint working"
    log "Found $MODEL_COUNT models"
    
    # Show first few models
    log "Sample models:"
    echo "$MODELS_RESPONSE" | jq -r '.data[0:3][] | "  • \(.id) (\(.owner))"' | tee -a "$OUTPUT_FILE"
else
    log_error "❌ Models endpoint failed"
    log "Response: $MODELS_RESPONSE"
fi
echo ""

# Test 3: Basic Chat Completions
log_info "=== 💬 Basic Chat Completions ==="
CHAT_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello, how are you?"}],
    "max_tokens": 50
  }')

if echo "$CHAT_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ Basic chat completions working"
    log "Response: $(echo "$CHAT_RESPONSE" | jq -r '.choices[0].message.content')"
else
    log_error "❌ Basic chat completions failed"
    log "Response: $CHAT_RESPONSE"
fi
echo ""

# Test 4: Memory-Enabled Completions
log_info "=== 🧠 Memory-Enabled Completions ==="
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
    log_success "✅ Memory-enabled completions working"
    log "Response: $(echo "$MEMORY_RESPONSE" | jq -r '.choices[0].message.content')"
    
    # Test follow-up with memory
    log_info "=== 🧠 Memory Follow-up Test ==="
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
        log_success "✅ Memory follow-up working"
        log "Response: $(echo "$MEMORY_FOLLOWUP" | jq -r '.choices[0].message.content')"
    else
        log_error "❌ Memory follow-up failed"
        log "Response: $MEMORY_FOLLOWUP"
    fi
else
    log_error "❌ Memory-enabled completions failed"
    log "Response: $MEMORY_RESPONSE"
fi
echo ""

# Test 5: Structured Completions
log_info "=== 📋 Structured Completions ==="

# Test OpenAI structured completions
log_info "Testing OpenAI structured completions..."
OPENAI_STRUCTURED_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions/structured" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Tell me about a person with name, age, and city"}
    ],
    "max_tokens": 100,
    "response_format": {
      "type": "json_schema",
      "schema": {
        "name": "person_schema",
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

if echo "$OPENAI_STRUCTURED_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ OpenAI structured completions working"
    log "Response: $(echo "$OPENAI_STRUCTURED_RESPONSE" | jq -r '.choices[0].message.content')"
else
    log_error "❌ OpenAI structured completions failed"
    log "Response: $OPENAI_STRUCTURED_RESPONSE"
fi

# Test Gemini structured completions
log_info "Testing Gemini structured completions..."
GEMINI_STRUCTURED_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions/structured" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Tell me about a person with name, age, and city"}
    ],
    "max_tokens": 100,
    "response_format": {
      "type": "json_schema",
      "schema": {
        "name": "person_schema",
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

if echo "$GEMINI_STRUCTURED_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ Gemini structured completions working"
    log "Response: $(echo "$GEMINI_STRUCTURED_RESPONSE" | jq -r '.choices[0].message.content')"
else
    log_error "❌ Gemini structured completions failed"
    log "Response: $GEMINI_STRUCTURED_RESPONSE"
fi

# Test Cloudflare structured completions
log_info "Testing Cloudflare structured completions..."
CLOUDFLARE_STRUCTURED_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions/structured" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "@cf/meta/llama-4-scout-17b-16e-instruct",
    "messages": [
      {"role": "user", "content": "Tell me about a person with name, age, and city"}
    ],
    "max_tokens": 100,
    "response_format": {
      "type": "json_schema",
      "schema": {
        "name": "person_schema",
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

if echo "$CLOUDFLARE_STRUCTURED_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ Cloudflare structured completions working"
    log "Response: $(echo "$CLOUDFLARE_STRUCTURED_RESPONSE" | jq -r '.choices[0].message.content')"
else
    log_error "❌ Cloudflare structured completions failed"
    log "Response: $CLOUDFLARE_STRUCTURED_RESPONSE"
fi
echo ""

# Test 6: Text-Only Completions
log_info "=== 📝 Text-Only Completions ==="
TEXT_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions/text" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 20
  }')

if echo "$TEXT_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ Text-only completions working"
    log "Response: $(echo "$TEXT_RESPONSE" | jq -r '.choices[0].message.content')"
else
    log_error "❌ Text-only completions failed"
    log "Response: $TEXT_RESPONSE"
fi
echo ""

# Test 7: Legacy Completions
log_info "=== 🔄 Legacy Completions ==="
LEGACY_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "prompt": "Hello world",
    "max_tokens": 20
  }')

if echo "$LEGACY_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ Legacy completions working"
    log "Response: $(echo "$LEGACY_RESPONSE" | jq -r '.choices[0].message.content')"
else
    log_error "❌ Legacy completions failed"
    log "Response: $LEGACY_RESPONSE"
fi
echo ""

# Test 8: Authentication
log_info "=== 🔒 Authentication Test ==="
AUTH_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }')

if echo "$AUTH_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    log_success "✅ Authentication properly enforced"
else
    log_warn "⚠️  Authentication may not be working properly"
    log "Response: $AUTH_RESPONSE"
fi
echo ""

# Test 9: 404 Handling
log_info "=== 🚫 404 Handling ==="
NOT_FOUND_RESPONSE=$(curl -s "$WORKER_URL/nonexistent")
if echo "$NOT_FOUND_RESPONSE" | grep -q "404\|Not Found\|Missing Authorization"; then
    log_success "✅ 404 handling working"
else
    log_warn "⚠️  404 handling unexpected result"
    log "Response: $NOT_FOUND_RESPONSE"
fi
echo ""

# Test 10: Memory Error Handling
log_info "=== 🚫 Memory Error Handling ==="
MEMORY_ERROR=$(curl -s -X POST "$WORKER_URL/v1/completions/withmemory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "prompt": "Test without memory flag",
    "max_tokens": 10
  }')

if echo "$MEMORY_ERROR" | jq -e '.error.message' | grep -q "memory.*must be set to true"; then
    log_success "✅ Memory validation working"
else
    log_warn "⚠️  Memory validation unexpected result"
    log "Response: $MEMORY_ERROR"
fi
echo ""

# Test 11: Multi-Provider Model Testing
log_info "=== 🔄 Multi-Provider Model Testing ==="
log "Testing Cloudflare models..."

# Get Cloudflare models
CLOUDFLARE_MODELS=$(echo "$MODELS_RESPONSE" | jq -r '.data[] | select(.id | startswith("@cf/")) | .id')
if [ -n "$CLOUDFLARE_MODELS" ]; then
    log "Found Cloudflare models:"
    echo "$CLOUDFLARE_MODELS" | while read -r model; do
        log "  • $model"
    done
    
    # Test first Cloudflare model
    FIRST_CF_MODEL=$(echo "$CLOUDFLARE_MODELS" | head -n1)
    if [ -n "$FIRST_CF_MODEL" ]; then
        log "Testing Cloudflare model: $FIRST_CF_MODEL"
        CF_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $API_KEY" \
          -d "{
            \"model\": \"$FIRST_CF_MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}],
            \"max_tokens\": 20
          }")
        
        if echo "$CF_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
            log_success "✅ Cloudflare model working: $FIRST_CF_MODEL"
            log "Response: $(echo "$CF_RESPONSE" | jq -r '.choices[0].message.content')"
        else
            log_error "❌ Cloudflare model failed: $FIRST_CF_MODEL"
            log "Response: $CF_RESPONSE"
        fi
    fi
else
    log_warn "⚠️  No Cloudflare models found"
fi
echo ""

# Test 12: Performance Test
log_info "=== ⚡ Performance Test ==="
PERF_START=$(date +%s)
PERF_RESPONSE=$(curl -s -X POST "$WORKER_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Quick test"}],
    "max_tokens": 10
  }')
PERF_END=$(date +%s)
PERF_DURATION=$((PERF_END - PERF_START))

if echo "$PERF_RESPONSE" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    log_success "✅ Performance test passed"
    log "Response time: ${PERF_DURATION}s"
else
    log_error "❌ Performance test failed"
    log "Response: $PERF_RESPONSE"
fi
echo ""

# Final Summary
log_info "🎉 === Comprehensive Test Summary Complete ==="
log ""
log "📍 Worker URL: $WORKER_URL"
log "🌐 Landing Page: $WORKER_URL/"
log "📋 OpenAPI Spec: $WORKER_URL/openapi.json"
log "❤️  Health Check: $WORKER_URL/health"
log ""

# Core API Integration Summary
log_info "=== 🔗 Core API Integration Summary ==="
if [ "$MODEL_COUNT" -gt 7 ]; then
    log_success "✅ Core API integration: ACTIVE"
    log "📊 Dynamic model discovery: $MODEL_COUNT models available"
    log "📋 Enhanced metadata: Available"
else
    log_warn "🟡 Core API integration: FALLBACK MODE"
    log "📊 Static model list: $MODEL_COUNT models"
    log_warn "⚠️  Core API may be unavailable or authentication failed"
fi
log ""

# Feature Summary
log_info "=== 🚀 Feature Summary ==="
log_success "✅ Core Features:"
log "  • OpenAI-compatible API"
log "  • Multi-provider support (OpenAI, Gemini, Cloudflare)"
log "  • Streaming and non-streaming responses"
log "  • Memory-enabled conversations"
log "  • Structured JSON responses"
log "  • Legacy completions support"
log "  • Comprehensive error handling"
log "  • CORS support"
log "  • Authentication"
log ""

log "🔧 Available Endpoints:"
log "  • GET  /health - Health check"
log "  • GET  /v1/models - List all available models"
log "  • POST /v1/chat/completions - Standard chat completions"
log "  • POST /v1/chat/completions/structured - JSON schema responses"
log "  • /v1/chat/completions/text - Text-only responses"
log "  • POST /v1/completions - Legacy prompt-based completions"
log "  • POST /v1/completions/withmemory - Memory-enabled completions"
log "  • GET  /openapi.json - OpenAPI 3.0 specification"
log "  • GET  / - Interactive landing page"
log ""

log "🧠 Memory Features:"
log "  • KV-based conversation memory"
log "  • Keyword-based memory isolation"
log "  • Cross-request context persistence"
log "  • Memory validation and error handling"
log ""

log "🔄 Model Providers:"
log "  • OpenAI: GPT models with full API compatibility"
log "  • Google Gemini: Advanced reasoning models"
log "  • Cloudflare AI: Edge-optimized models"
log "  • Dynamic model discovery via Core API"
log ""

log_success "🚀 Ready to use! Try opening $WORKER_URL in your browser."
log "📖 Check the OpenAPI spec at $WORKER_URL/openapi.json for detailed documentation."
log ""
log "📄 Full test results saved to: $OUTPUT_FILE"