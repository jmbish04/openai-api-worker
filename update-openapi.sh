#!/bin/bash

# OpenAPI Model List Updater
# This script updates the OpenAPI JSON file with current model capabilities
# and provides clear warnings about static list limitations.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 OpenAPI Model List Updater${NC}"
echo "=========================================="

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    echo "Please install Python 3 and try again."
    exit 1
fi

# Check if the script exists
if [ ! -f "update-openapi-models.py" ]; then
    echo -e "${RED}❌ update-openapi-models.py not found.${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if OpenAPI file exists
if [ ! -f "static/openapi.json" ]; then
    echo -e "${RED}❌ static/openapi.json not found.${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "• This script updates the OpenAPI documentation with static model lists"
echo "• The actual API validation uses current model lists from the server"
echo "• If model lists become outdated, the API will still work correctly"
echo "• The documentation may not reflect the latest model capabilities"
echo ""

# Ask for confirmation
read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Operation cancelled.${NC}"
    exit 0
fi

echo -e "${BLUE}🔄 Updating OpenAPI file...${NC}"

# Run the Python script
python3 update-openapi-models.py

echo ""
echo -e "${GREEN}✅ OpenAPI file updated successfully!${NC}"
echo ""
echo -e "${BLUE}📋 What was updated:${NC}"
echo "• Added model capabilities information to the info section"
echo "• Updated structured completions endpoint description with model counts"
echo "• Added model examples to request body schemas"
echo "• Added clear warnings about static list limitations"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "• Review the updated OpenAPI file: static/openapi.json"
echo "• Deploy the changes if needed"
echo "• Consider running this script regularly to keep documentation current"
echo ""
echo -e "${BLUE}🔗 View the updated API spec:${NC}"
echo "• Local: http://localhost:8787/openapi.json"
echo "• Production: https://openai-api-worker.hacolby.workers.dev/openapi.json"
