#!/usr/bin/env python3
"""
OpenAPI Model List Updater

This script updates the OpenAPI JSON file with the current recommended models
for structured responses and other capabilities. It reads from the model-info.ts
file and updates the OpenAPI specification accordingly.

Note: This is a static list generator. If the model lists become out of date,
the actual API validation will still work correctly, but the documentation
may not reflect the latest model capabilities.

Usage:
    python update-openapi-models.py [--openapi-file path/to/openapi.json]
"""

import json
import re
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any

def extract_model_lists_from_typescript(file_path: str) -> Dict[str, List[str]]:
    """
    Extract model lists from the TypeScript model-info.ts file.
    This is a simple parser that looks for exported const arrays.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    model_lists = {}
    
    # Pattern to match exported const arrays
    pattern = r'export const (\w+) = \[(.*?)\];'
    
    for match in re.finditer(pattern, content, re.DOTALL):
        const_name = match.group(1)
        array_content = match.group(2)
        
        # Extract string values from the array
        string_pattern = r'"([^"]+)"'
        strings = re.findall(string_pattern, array_content)
        
        if strings:
            model_lists[const_name] = strings
    
    return model_lists

def get_recommended_models() -> Dict[str, Dict[str, Any]]:
    """
    Get the recommended models for each provider and capability.
    This is a static mapping based on the current model-info.ts file.
    """
    return {
        "openai": {
            "structured_outputs": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4o-2024-08-06",
                "gpt-4o-mini-2024-07-18"
            ],
            "function_calling": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4o-2024-08-06",
                "gpt-4o-mini-2024-07-18",
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4-0613",
                "gpt-3.5-turbo-0613"
            ],
            "vision": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4o-2024-08-06",
                "gpt-4o-mini-2024-07-18",
                "gpt-4.1",
                "gpt-4.1-mini"
            ],
            "recommended": "gpt-4o-mini"
        },
        "gemini": {
            "structured_outputs": [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite"
            ],
            "function_calling": [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite"
            ],
            "vision": [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite"
            ],
            "recommended": "gemini-2.5-flash"
        },
        "cloudflare": {
            "structured_outputs": [
                "@cf/meta/llama-4-scout-17b-16e-instruct",
                "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                "@cf/meta/llama-3.1-8b-instruct-fp8",
                "@cf/meta/llama-3.1-8b-instruct-awq",
                "@cf/meta/llama-3-8b-instruct-awq",
                "@cf/meta/llama-3-8b-instruct",
                "@cf/meta/llama-3.2-11b-vision-instruct",
                "@cf/meta/llama-3.2-3b-instruct",
                "@cf/meta/llama-3.2-1b-instruct",
                "@cf/mistralai/mistral-small-3.1-24b-instruct",
                "@cf/mistral/mistral-7b-instruct-v0.2-lora",
                "@cf/mistral/mistral-7b-instruct-v0.1",
                "@cf/qwen/qwen2.5-coder-32b-instruct",
                "@cf/qwen/qwen1.5-14b-chat-awq",
                "@cf/qwen/qwen1.5-7b-chat-awq",
                "@cf/qwen/qwen1.5-1.8b-chat",
                "@cf/qwen/qwen1.5-0.5b-chat",
                "@cf/google/gemma-3-12b-it",
                "@cf/google/gemma-7b-it-lora",
                "@cf/google/gemma-2b-it-lora",
                "@cf/openchat/openchat-3.5-0106",
                "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
                "@cf/deepseek-ai/deepseek-math-7b-instruct",
                "@cf/defog/sqlcoder-7b-2"
            ],
            "vision": [
                "@cf/meta/llama-3.2-11b-vision-instruct",
                "@cf/llava-hf/llava-1.5-7b-hf"
            ],
            "reasoning": [
                "@cf/meta/llama-4-scout-17b-16e-instruct",
                "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
                "@cf/deepseek-ai/deepseek-math-7b-instruct"
            ],
            "recommended": "@cf/meta/llama-4-scout-17b-16e-instruct"
        }
    }

def update_openapi_schema(openapi_data: Dict[str, Any], model_capabilities: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Update the OpenAPI schema with model capabilities information.
    """
    # Add model capabilities to the info section
    if "info" not in openapi_data:
        openapi_data["info"] = {}
    
    openapi_data["info"]["x-model-capabilities"] = {
        "description": "Model capabilities by provider. Note: This is a static list that may become outdated. The actual API validation will always use the current model lists from the server.",
        "providers": model_capabilities
    }
    
    # Update the structured completions endpoint description
    if "paths" in openapi_data and "/v1/chat/completions/structured" in openapi_data["paths"]:
        structured_path = openapi_data["paths"]["/v1/chat/completions/structured"]
        if "post" in structured_path:
            post_spec = structured_path["post"]
            if "description" not in post_spec:
                post_spec["description"] = ""
            
            # Add model recommendations to the description
            model_info = []
            for provider, capabilities in model_capabilities.items():
                recommended = capabilities.get("recommended", "N/A")
                structured_count = len(capabilities.get("structured_outputs", []))
                model_info.append(f"- **{provider.title()}**: {structured_count} models supported (recommended: `{recommended}`)")
            
            post_spec["description"] += f"\n\n**Supported Models for Structured Outputs:**\n" + "\n".join(model_info)
            post_spec["description"] += f"\n\n*Note: This is a static list. The actual API validation uses current model lists from the server.*"
    
    # Add model examples to the request body schema
    if "components" in openapi_data and "schemas" in openapi_data["components"]:
        schemas = openapi_data["components"]["schemas"]
        
        # Update the model field in request schemas to include examples
        for schema_name in ["ChatCompletionRequest", "StructuredChatCompletionRequest", "TextChatCompletionRequest"]:
            if schema_name in schemas and "properties" in schemas[schema_name]:
                properties = schemas[schema_name]["properties"]
                if "model" in properties:
                    # Add examples for each provider
                    examples = []
                    for provider, capabilities in model_capabilities.items():
                        recommended = capabilities.get("recommended")
                        if recommended:
                            examples.append({
                                "provider": provider,
                                "recommended": recommended,
                                "supported_models": capabilities.get("structured_outputs", [])[:5]  # First 5 models
                            })
                    
                    properties["model"]["x-examples"] = examples
                    properties["model"]["description"] = f"Model identifier. Examples: {', '.join([cap.get('recommended', 'N/A') for cap in model_capabilities.values()])}"
    
    return openapi_data

def main():
    parser = argparse.ArgumentParser(description="Update OpenAPI JSON with model capabilities")
    parser.add_argument("--openapi-file", default="static/openapi.json", 
                       help="Path to the OpenAPI JSON file (default: static/openapi.json)")
    parser.add_argument("--model-info-file", default="src/handlers/model-info.ts",
                       help="Path to the model-info.ts file (default: src/handlers/model-info.ts)")
    parser.add_argument("--dry-run", action="store_true",
                       help="Show what would be updated without making changes")
    
    args = parser.parse_args()
    
    # Check if files exist
    openapi_path = Path(args.openapi_file)
    model_info_path = Path(args.model_info_file)
    
    if not openapi_path.exists():
        print(f"Error: OpenAPI file not found: {openapi_path}")
        sys.exit(1)
    
    if not model_info_path.exists():
        print(f"Error: Model info file not found: {model_info_path}")
        sys.exit(1)
    
    # Get model capabilities
    print("📋 Getting model capabilities...")
    model_capabilities = get_recommended_models()
    
    # Load OpenAPI file
    print(f"📖 Loading OpenAPI file: {openapi_path}")
    with open(openapi_path, 'r', encoding='utf-8') as f:
        openapi_data = json.load(f)
    
    # Update the schema
    print("🔄 Updating OpenAPI schema...")
    updated_data = update_openapi_schema(openapi_data, model_capabilities)
    
    if args.dry_run:
        print("🔍 Dry run - showing changes that would be made:")
        print(json.dumps(updated_data, indent=2))
        return
    
    # Write back to file
    print(f"💾 Writing updated OpenAPI file: {openapi_path}")
    with open(openapi_path, 'w', encoding='utf-8') as f:
        json.dump(updated_data, f, indent=2, ensure_ascii=False)
    
    print("✅ OpenAPI file updated successfully!")
    print("\n📊 Summary of model capabilities:")
    for provider, capabilities in model_capabilities.items():
        structured_count = len(capabilities.get("structured_outputs", []))
        recommended = capabilities.get("recommended", "N/A")
        print(f"  • {provider.title()}: {structured_count} structured models (recommended: {recommended})")
    
    print(f"\n⚠️  Note: This is a static list that may become outdated.")
    print(f"   The actual API validation uses current model lists from the server.")

if __name__ == "__main__":
    main()
