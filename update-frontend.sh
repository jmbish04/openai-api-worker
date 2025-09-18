#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎨 Frontend Update Script${NC}"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}❌ Error: wrangler.toml not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${BLUE}📝 Updating frontend with:${NC}"
echo "  • Dynamic models list from core API"
echo "  • Fixed streaming functionality"
echo "  • Enhanced code snippets with copy buttons"
echo "  • Proper newline formatting"
echo ""

# Backup original file
echo -e "${YELLOW}💾 Creating backup of current frontend...${NC}"
cp static/index.html static/index.html.backup
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created: static/index.html.backup${NC}"
else
    echo -e "${RED}❌ Failed to create backup${NC}"
    exit 1
fi

# Update the frontend HTML file
echo -e "${BLUE}🔄 Updating frontend HTML...${NC}"
cat > static/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenAI-Compatible API Worker</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
            font-size: 3rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
        }

        .badges {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 20px;
        }

        .badge {
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
        }

        .badge.streaming { background: #2196F3; }
        .badge.multimodal { background: #FF9800; }
        .badge.cors { background: #9C27B0; }

        .content {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .nav {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 2px solid #eee;
            overflow-x: auto;
            flex-wrap: wrap;
        }

        .nav-item {
            padding: 12px 20px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
            white-space: nowrap;
            font-weight: 600;
            border-radius: 8px 8px 0 0;
        }

        .nav-item:hover {
            background: #f5f5f5;
        }

        .nav-item.active {
            border-bottom-color: #667eea;
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
        }

        .section {
            display: none;
        }

        .section.active {
            display: block;
        }

        .section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 2rem;
        }

        .section h3 {
            color: #555;
            margin: 30px 0 15px 0;
            font-size: 1.3rem;
        }

        .code-block {
            background: #2d3748;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
            margin: 20px 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9