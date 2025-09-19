# OpenAPI Model List Updater

This directory contains scripts to automatically update the OpenAPI JSON file with current model capabilities and recommendations.

## ⚠️ Important Notes

**This is a static list generator.** The scripts update the OpenAPI documentation with model lists, but:

- The actual API validation uses current model lists from the server
- If the static lists become outdated, the API will still work correctly
- The documentation may not reflect the latest model capabilities
- The server-side validation is always authoritative

## Scripts

### 1. `update-openapi-models.py` (Python Script)

The main Python script that updates the OpenAPI JSON file.

**Features:**
- Reads model capabilities from the codebase
- Updates OpenAPI schema with model information
- Adds provider-specific model recommendations
- Includes clear warnings about static list limitations

**Usage:**
```bash
# Update the OpenAPI file
python3 update-openapi-models.py

# Dry run (show changes without updating)
python3 update-openapi-models.py --dry-run

# Specify custom file paths
python3 update-openapi-models.py --openapi-file custom/openapi.json --model-info-file src/handlers/model-info.ts
```

**Options:**
- `--openapi-file`: Path to OpenAPI JSON file (default: `static/openapi.json`)
- `--model-info-file`: Path to model-info.ts file (default: `src/handlers/model-info.ts`)
- `--dry-run`: Show changes without updating the file

### 2. `update-openapi.sh` (Bash Wrapper)

A user-friendly bash script that wraps the Python script with better UX.

**Features:**
- Colorized output
- Pre-flight checks
- User confirmation
- Clear warnings about static list limitations
- Helpful next steps

**Usage:**
```bash
# Run the updater
./update-openapi.sh
```

## What Gets Updated

The scripts update the OpenAPI file with:

1. **Model Capabilities Section** (`x-model-capabilities`):
   - Provider-specific model lists
   - Capability breakdowns (structured_outputs, function_calling, vision, etc.)
   - Recommended models per provider

2. **Endpoint Descriptions**:
   - Updated structured completions endpoint with model counts
   - Provider-specific recommendations
   - Clear warnings about static list limitations

3. **Schema Examples**:
   - Model field examples with provider information
   - Supported model lists for each provider
   - Recommended models for quick reference

## Model Capabilities by Provider

### OpenAI
- **Structured Outputs**: 4 models (gpt-4o, gpt-4o-mini, etc.)
- **Function Calling**: 8 models (includes 4.1 family)
- **Vision**: 6 models (4o and 4.1 families)
- **Recommended**: `gpt-4o-mini`

### Gemini
- **Structured Outputs**: 5 models (2.5 and 2.0 families)
- **Function Calling**: 5 models (same as structured)
- **Vision**: 5 models (all Gemini models support vision)
- **Recommended**: `gemini-2.5-flash`

### Cloudflare
- **Structured Outputs**: 24 models (various OSS models)
- **Vision**: 2 models (Llama 3.2 Vision, LLaVA)
- **Reasoning**: 3 models (Llama-4 Scout, DeepSeek models)
- **Recommended**: `@cf/meta/llama-4-scout-17b-16e-instruct`

## When to Run

Run these scripts when:

- Model lists are updated in `src/handlers/model-info.ts`
- New model capabilities are added
- You want to keep documentation current
- Before major releases

## Automation

Consider adding to your CI/CD pipeline:

```bash
# In your deployment script
python3 update-openapi-models.py
git add static/openapi.json
git commit -m "Update OpenAPI with latest model capabilities"
```

## Troubleshooting

### Python 3 Not Found
```bash
# Install Python 3 (Ubuntu/Debian)
sudo apt update && sudo apt install python3

# Install Python 3 (macOS)
brew install python3
```

### Permission Denied
```bash
# Make scripts executable
chmod +x update-openapi.sh
chmod +x update-openapi-models.py
```

### File Not Found
- Ensure you're running from the project root directory
- Check that `static/openapi.json` exists
- Verify `src/handlers/model-info.ts` exists

## Example Output

```
📋 Getting model capabilities...
📖 Loading OpenAPI file: static/openapi.json
🔄 Updating OpenAPI schema...
💾 Writing updated OpenAPI file: static/openapi.json
✅ OpenAPI file updated successfully!

📊 Summary of model capabilities:
  • Openai: 4 structured models (recommended: gpt-4o-mini)
  • Gemini: 5 structured models (recommended: gemini-2.5-flash)
  • Cloudflare: 24 structured models (recommended: @cf/meta/llama-4-scout-17b-16e-instruct)

⚠️  Note: This is a static list that may become outdated.
   The actual API validation uses current model lists from the server.
```

## Contributing

When adding new model capabilities:

1. Update `src/handlers/model-info.ts` with new model lists
2. Update the `get_recommended_models()` function in `update-openapi-models.py`
3. Run the updater to refresh the OpenAPI documentation
4. Test that the API validation still works correctly
