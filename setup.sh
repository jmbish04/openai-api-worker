#!/bin/bash

# OpenAI-Compatible API Worker Setup Script
# This script helps set up the worker with proper environment variables and deployment

set -e

echo "🚀 OpenAI-Compatible API Worker Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    print_error "wrangler.toml not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    print_error "Neither pnpm nor npm found. Please install Node.js and npm."
    exit 1
fi

print_success "Dependencies installed!"

# Environment setup
echo ""
print_status "Setting up environment variables..."

# Check if .dev.vars exists
if [ ! -f ".dev.vars" ]; then
    print_status "Creating .dev.vars.example file..."
    cat > .dev.vars.example << 'EOF'
# Worker Configuration
WORKER_API_KEY=sk-worker-your-secure-api-key-here
DEBUG_LOGGING=true

# Provider API Keys (optional - comment out if not using)
# OPENAI_API_KEY=sk-your-openai-api-key-here
# GEMINI_API_KEY=your-gemini-api-key-here

# Core API Worker (if using separate core-api worker)
# CORE_WORKER_API_KEY=your-core-worker-api-key-here
EOF
    print_success ".env file created! Please edit it with your actual API keys."
else
    print_warning ".env file already exists. Skipping creation."
fi

# Development environment
echo ""
print_status "Setting up development environment..."


# --- Production Secrets Setup ---
if [ -f ".dev.vars" ]; then
  # check if required keys are present
  if grep -q 'WORKER_API_KEY=' .dev.vars && grep -q 'WORKER_URI=' .dev.vars; then
    echo ""
    print_status "Production deployment setup..."

    read -p "$(echo -e ${YELLOW}Do you want to set up production secrets now? [y/N]:${NC} )" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Setting up production secrets..."
        wrangler secret bulk .dev.vars
        print_success "Production secrets configured!"
    else
        print_status "Skipping production secrets setup."
        print_warning "Remember to set secrets before deploying with:"
        print_warning "  wrangler secret put WORKER_API_KEY"
        print_warning "  wrangler secret put OPENAI_API_KEY (optional)"
        print_warning "  wrangler secret put GEMINI_API_KEY (optional)"
    fi
  else
    print_warning ".dev.vars found but missing WORKER_API_KEY or WORKER_URI. Fill them in first."
  fi
else
  print_warning "No .dev.vars file found. Skipping secret deployment setup."
fi


# Deployment
echo ""
read -p "$(echo -e ${YELLOW}Do you want to deploy the worker now? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Deploying worker..."
    wrangler deploy
    print_success "Worker deployed!"

    # Get worker URL
    print_success "Worker URL: https://openai-api-worker.hacolby.workers.dev"

else
    print_status "Skipping deployment. You can deploy later with: wrangler deploy"
fi

# Final instructions
echo ""
print_success "Setup complete! 🎉"
echo ""
echo "Next steps:"
echo "1. Edit .env and .dev.vars with your actual API keys"
echo "2. Test locally with: wrangler dev"
echo "3. Deploy with: wrangler deploy"
echo ""
echo "API Endpoints:"
echo "• Health: GET /health"
echo "• Models: GET /v1/models"
echo "• Chat: POST /v1/chat/completions"
echo "• Test UI: GET /test-dropdowns.html"
echo ""
echo "For testing, use your WORKER_API_KEY as the Authorization header:"
echo "Authorization: Bearer YOUR_WORKER_API_KEY"
