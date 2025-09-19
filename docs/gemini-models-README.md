# Gemini Models CLI Script

This script fetches and displays available Google Gemini models using the `@google/genai` SDK.

## Setup

1. **Set your Gemini API key** as an environment variable:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

2. **Install dependencies** (if not already done):
   ```bash
   pnpm install
   ```

## Running the Script

### Option 1: Using npm script (recommended)
```bash
pnpm run gemini-models
```

### Option 2: Direct execution with tsx
```bash
npx tsx gemini-models.ts
```

### Option 3: Compile and run with Node.js
```bash
npx tsc gemini-models.ts
node gemini-models.js
```

## Output

The script will show:
1. **Raw Response**: The complete JSON response from the Gemini API
2. **Parsed Models**: A formatted list of available models with their details including:
   - Model name and display name
   - Input and output token limits
   - Description

## Example Output

```
Fetching available Gemini models...

=== RAW RESPONSE ===
{
  "models": [
    {
      "name": "models/gemini-1.5-pro",
      "displayName": "Gemini 1.5 Pro",
      "description": "The most capable Gemini model for complex tasks",
      "inputTokenLimit": 2000000,
      "outputTokenLimit": 8192
    }
  ]
}

=== PARSED MODELS ===
Found 1 models:

models/gemini-1.5-pro — Gemini 1.5 Pro
  Input: 2000000, Output: 8192
  Description: The most capable Gemini model for complex tasks
-----
```

## Troubleshooting

- **"GEMINI_API_KEY environment variable is not set"**: Make sure you've exported your API key
- **"Error fetching models"**: Check your API key and internet connection
- **TypeScript errors**: The script uses `any[]` types to handle the dynamic API response structure
