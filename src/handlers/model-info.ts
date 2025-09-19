/**
 * @file src/handlers/model-info.ts
 * @description Model information constants and utilities for service handlers.
 *              This file contains model lists, capabilities, and other constants
 *              that can be shared across different AI provider handlers.
 *
 * Notes:
 * - OpenAI has two “structured output” paths:
 *   (1) response_format: { type: "json_schema", strict: true } → reliably supported on GPT-4o family
 *   (2) tools (function calling) with strict: true → supported on models that support tools (4o, 4.1, and 0613+)
 * - Gemini supports structured output via responseSchema across current Gemini API models.
 * - Cloudflare Workers AI capabilities are model-dependent (OSS bases). Treat “structured” as enforced by prompting/tools;
 *   keep allowlists per upstream model you validate.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * OpenAI
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * OpenAI models that support structured outputs via JSON Schema
 * (response_format: { type: "json_schema", strict: true }).
 * Keep both dated SKUs and generic prefixes so prefix matching works.
 */
export const OPENAI_STRUCTURED_MODELS = [
    "gpt-4o",                 // Multimodal 4o family; JSON schema supported (use latest dated build where possible).
    "gpt-4o-2024-08-06",      // Explicitly documented 4o release with json_schema support.
    "gpt-4o-mini",            // Smaller/cheaper 4o; supports json_schema.
    "gpt-4o-mini-2024-07-18"  // Dated 4o-mini release with json_schema support.
  ];
  
  /**
   * OpenAI models that support function calling (tools) with strict schema checking.
   * Include 4o/4.1 families and (optionally) legacy 0613 variants if still enabled in your tenant.
   */
  export const OPENAI_FUNCTION_CALLING_MODELS = [
    "gpt-4o",                 // 4o supports tools + strict.
    "gpt-4o-2024-08-06",      // Dated 4o; tools + strict.
    "gpt-4o-mini",            // 4o-mini; tools + strict.
    "gpt-4o-mini-2024-07-18", // Dated 4o-mini.
    "gpt-4.1",                // 4.1 family supports tools; prefer tools+strict (JSON schema not guaranteed).
    "gpt-4.1-mini",
    // Legacy tool-capable lines (often retired/migrated; keep only if you know they’re active for your account):
    "gpt-4-0613",             // Legacy tools model (may be sunset in many orgs).
    "gpt-3.5-turbo-0613"      // Legacy tools model (may be sunset in many orgs).
  ];
  
  /**
   * OpenAI models that support vision (image input)
   */
  export const OPENAI_VISION_MODELS = [
    "gpt-4o",                 // Multimodal (text+vision).
    "gpt-4o-2024-08-06",
    "gpt-4o-mini",
    "gpt-4o-mini-2024-07-18",
    "gpt-4.1",                // Vision-enabled per current family notes.
    "gpt-4.1-mini"
    // (Optional legacy: "gpt-4-turbo-vision" if still available in your tenant)
  ];
  
  /* ────────────────────────────────────────────────────────────────────────────
   * Google Gemini (Gemini API)
   * ────────────────────────────────────────────────────────────────────────────
   */
  
  /**
   * Gemini models that support structured outputs (responseSchema)
   * Gemini API enforces JSON shape via responseSchema on core model families.
   */
  export const GEMINI_STRUCTURED_MODELS = [
    "gemini-2.5-pro",         // Flagship Gemini; responseSchema supported.
    "gemini-2.5-flash",       // Fast/cheap; responseSchema supported.
    "gemini-2.5-flash-lite",  // Lowest latency/cost; responseSchema supported.
    "gemini-2.0-flash",       // Earlier family; responseSchema supported.
    "gemini-2.0-flash-lite"
  ];
  
  /**
   * Gemini models that support function calling (tools)
   */
  export const GEMINI_FUNCTION_CALLING_MODELS = [
    "gemini-2.5-pro",         // Tool/function calling supported.
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  ];
  
  /* ────────────────────────────────────────────────────────────────────────────
   * Cloudflare Workers AI
   * ────────────────────────────────────────────────────────────────────────────
   * NOTE: Cloudflare exposes OSS models; “structured output” is not a platform flag.
   * Treat these as allowlists you’ve validated to follow JSON-friendly instructions well.
   * Vision models are explicitly published in Cloudflare docs.
   */
  
  /**
   * Cloudflare models generally suitable for structured outputs (JSON-friendly)
   * (You can enforce JSON via prompting or tool adapters on your side.)
   */
  export const CLOUDFLARE_STRUCTURED_MODELS = [
    "@cf/meta/llama-4-scout-17b-16e-instruct", // Meta Llama-4 Scout (reasoning-optimized; strong instruction following).
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",// Large Llama 3.3 Instruct; latency-optimized FP8.
    "@cf/meta/llama-3.1-8b-instruct-fp8",      // Llama 3.1 8B Instruct (FP8).
    "@cf/meta/llama-3.1-8b-instruct-awq",      // Llama 3.1 8B Instruct (AWQ).
    "@cf/meta/llama-3-8b-instruct-awq",        // Llama 3 8B Instruct (AWQ).
    "@cf/meta/llama-3-8b-instruct",            // Llama 3 8B Instruct baseline.
    "@cf/meta/llama-3.2-11b-vision-instruct",  // Multimodal Llama 3.2 Vision (can still emit JSON for text tasks).
    "@cf/meta/llama-3.2-3b-instruct",          // Lighter Llama 3.2 Instruct.
    "@cf/meta/llama-3.2-1b-instruct",          // Tiny Llama 3.2 Instruct.
    "@cf/mistralai/mistral-small-3.1-24b-instruct", // Mistral 24B Instruct.
    "@cf/mistral/mistral-7b-instruct-v0.2-lora",    // Mistral 7B Instruct LoRA.
    "@cf/mistral/mistral-7b-instruct-v0.1",         // Older Mistral 7B Instruct.
    "@cf/qwen/qwen2.5-coder-32b-instruct",     // Qwen 2.5 Coder (JSON output common for tool/analysis tasks).
    "@cf/qwen/qwen1.5-14b-chat-awq",           // Qwen 1.5 chat variants.
    "@cf/qwen/qwen1.5-7b-chat-awq",
    "@cf/qwen/qwen1.5-1.8b-chat",
    "@cf/qwen/qwen1.5-0.5b-chat",
    "@cf/google/gemma-3-12b-it",               // Gemma 3 12B IT on CF.
    "@cf/google/gemma-7b-it-lora",             // Gemma 7B IT LoRA.
    "@cf/google/gemma-2b-it-lora",             // Gemma 2B IT LoRA.
    "@cf/openchat/openchat-3.5-0106",          // OpenChat 3.5 (instruction tuned).
    "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", // DeepSeek reasoning distilled model.
    "@cf/deepseek-ai/deepseek-math-7b-instruct",    // Math-tuned model (still JSON-capable for structured tasks).
    "@cf/defog/sqlcoder-7b-2"                  // SQLCoder (often produces structured SQL/JSON outputs reliably).
  ];
  
  /**
   * Cloudflare models that support vision (image input)
   * (Explicitly documented as vision-capable in CF docs.)
   */
  export const CLOUDFLARE_VISION_MODELS = [
    "@cf/meta/llama-3.2-11b-vision-instruct",  // Meta Llama 3.2 Vision Instruct (image understanding & reasoning).
    "@cf/llava-hf/llava-1.5-7b-hf"             // LLaVA 1.5 7B (HF) vision model.
  ];
  
  /**
   * Cloudflare models optimized for reasoning
   */
  export const CLOUDFLARE_REASONING_MODELS = [
    "@cf/meta/llama-4-scout-17b-16e-instruct", // Llama-4 Scout reasoning focus.
    "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", // Reasoning distilled.
    "@cf/deepseek-ai/deepseek-math-7b-instruct"     // Math/logic specialty.
  ];
  
  /* ────────────────────────────────────────────────────────────────────────────
   * Capability helpers (kept compatible with your existing usage)
   * ────────────────────────────────────────────────────────────────────────────
   */
  
  /**
   * Check if a model supports structured outputs
   */
  export function supportsStructuredOutputs(
    model: string,
    provider: 'openai' | 'gemini' | 'cloudflare'
  ): boolean {
    const id = model.toLowerCase();
    switch (provider) {
      case 'openai':
        return OPENAI_STRUCTURED_MODELS.some(m => id.startsWith(m.toLowerCase()))
          || OPENAI_FUNCTION_CALLING_MODELS.some(m => id.startsWith(m.toLowerCase()));
      case 'gemini':
        return GEMINI_STRUCTURED_MODELS.some(m => id.startsWith(m.toLowerCase()));
      case 'cloudflare':
        return CLOUDFLARE_STRUCTURED_MODELS.some(m => id.startsWith(m.toLowerCase()));
      default:
        return false;
    }
  }
  
  /**
   * Check if a model supports function calling
   */
  export function supportsFunctionCalling(
    model: string,
    provider: 'openai' | 'gemini' | 'cloudflare'
  ): boolean {
    const id = model.toLowerCase();
    switch (provider) {
      case 'openai':
        return OPENAI_FUNCTION_CALLING_MODELS.some(m => id.startsWith(m.toLowerCase()));
      case 'gemini':
        return GEMINI_FUNCTION_CALLING_MODELS.some(m => id.startsWith(m.toLowerCase()));
      case 'cloudflare':
        // Treat as “structured via allowlist” for OSS bases.
        return CLOUDFLARE_STRUCTURED_MODELS.some(m => id.startsWith(m.toLowerCase()));
      default:
        return false;
    }
  }
  
  /**
   * Check if a model supports vision (image input)
   */
  export function supportsVision(
    model: string,
    provider: 'openai' | 'gemini' | 'cloudflare'
  ): boolean {
    const id = model.toLowerCase();
    switch (provider) {
      case 'openai':
        return OPENAI_VISION_MODELS.some(m => id.startsWith(m.toLowerCase()));
      case 'gemini':
        // Gemini core families are multimodal; treat as true for Gemini IDs.
        return id.includes('gemini');
      case 'cloudflare':
        return CLOUDFLARE_VISION_MODELS.some(m => id.startsWith(m.toLowerCase()));
      default:
        return false;
    }
  }
  
  /**
   * Get the recommended model for structured outputs by provider
   */
  export function getRecommendedStructuredModel(
    provider: 'openai' | 'gemini' | 'cloudflare'
  ): string {
    switch (provider) {
      case 'openai':
        return 'gpt-4o-mini';                 // Cost-effective and supports JSON schema + tools strict.
      case 'gemini':
        return 'gemini-2.5-flash';            // Fast and supports responseSchema.
      case 'cloudflare':
        return '@cf/meta/llama-4-scout-17b-16e-instruct'; // Strong reasoning/instructions; JSON via prompting/tooling.
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  /**
   * Get all available models for a provider (structured-inclined sets)
   */
  export function getAvailableModels(provider: 'openai' | 'gemini' | 'cloudflare'): string[] {
    switch (provider) {
      case 'openai':
        return OPENAI_STRUCTURED_MODELS;
      case 'gemini':
        return GEMINI_STRUCTURED_MODELS;
      case 'cloudflare':
        return CLOUDFLARE_STRUCTURED_MODELS;
      default:
        return [];
    }
  }
  
  /**
   * Get available structured models for a provider (alias of above)
   */
  export function getAvailableStructuredModels(provider: 'openai' | 'gemini' | 'cloudflare'): string[] {
    return getAvailableModels(provider);
  }
  
  /**
   * Detect provider from model name
   */
  export function detectProvider(model: string): 'openai' | 'gemini' | 'cloudflare' | null {
    const modelLower = model.toLowerCase();
    if (modelLower.startsWith('@cf/')) return 'cloudflare';
    if (modelLower.includes('gemini')) return 'gemini';
    if (modelLower.includes('gpt') || modelLower.includes('o1') || modelLower.includes('o3') || modelLower.includes('o4')) return 'openai';
    return null;
  }