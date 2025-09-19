/**
 * @file src/models.ts
 * @description This file contains the logic for handling and routing requests to different
 *              AI model providers. It includes functions for detecting the appropriate provider
 *              based on the model name, mapping generic model names to provider-specific ones,
 *              and fetching lists of available models from each configured provider.
 *              It also handles message format conversions required by different models.
 */

import OpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";
import type { ApiModel, ChatMessage, CloudflareAIModelsResponse, ModelType, Provider } from './types';
import { debugLog, errorLog } from './utils';

/**
 * Detects the appropriate AI provider based on the model name string.
 * This routing logic is key to the worker's ability to act as a unified gateway.
 *
 * @param {string} model - The model name from the request (e.g., 'gpt-4', '@cf/meta/llama-3-8b-instruct').
 * @param {Env} env - The worker's environment variables, used to check for API key presence.
 * @returns {Provider} The detected provider ('cloudflare', 'openai', or 'gemini'). Defaults to 'cloudflare'.
 */
export function detectProvider(model: string, env: Env): Provider {
    const m = model.toLowerCase();
    if (m.startsWith('@cf/')) return 'cloudflare';
    if (m.includes('gpt')) return 'openai';
    if (m.includes('gemini') || m.includes('bison')) return 'gemini';
    // Fallback for common OpenAI models if an API key is present.
    if (env.OPENAI_API_KEY && (m === 'gpt-4' || m === 'gpt-3.5-turbo')) return 'openai';
    return 'cloudflare';
}

/**
 * Determines the specific type of a model, which is crucial for Cloudflare models
 * that require different input formats (e.g., chat messages vs. a single prompt string).
 *
 * @param {string} model - The full model name.
 * @param {Provider} provider - The provider for the model.
 * @returns {ModelType} The determined model type (e.g., 'llama4', 'openai', 'input').
 */
export function getModelType(model: string, provider: Provider): ModelType {
    if (provider === 'cloudflare') {
        const m = model.toLowerCase();
        if (m.includes('llama-4')) return 'llama4'; // Models supporting chat messages
        if (m.includes('llama')) return 'llama';   // Models requiring specific prompt templating
        if (m.includes('openai') || m.includes('gpt-oss')) return 'llama4';
    }
    if (provider === 'openai') return 'openai';
    if (provider === 'gemini') return 'gemini';
    return 'input'; // Generic fallback
}

/**
 * Determines whether a request should use a structured response format (JSON)
 * based on the model, provider, and the `response_format` parameter.
 *
 * @param {string} model - The model name.
 * @param {Provider} provider - The provider for the model.
 * @param {any} [responseFormat] - The `response_format` object from the request body.
 * @returns {boolean} `true` if a structured response should be used, `false` otherwise.
 */
export function shouldUseStructuredResponse(model: string, provider: Provider, responseFormat?: any): boolean {
    if (provider === 'gemini' || provider === 'openai') {
        return responseFormat && responseFormat.type !== 'text';
    }
    
    if (provider === 'cloudflare') {
        const cloudflareStructuredModels = [
            '@cf/meta/llama-4-scout-17b-16e-instruct',
            '@cf/meta/llama-3-8b-instruct',
            '@cf/meta/llama-3-70b-instruct',
        ];
        
        return cloudflareStructuredModels.includes(model) && 
               responseFormat && 
               responseFormat.type !== 'text';
    }
    
    return false;
}

/**
 * Recursively adds `additionalProperties: false` to all object schemas.
 * This is a workaround to ensure compatibility with OpenAI's API, which requires this
 * property for stricter JSON schema validation.
 *
 * @param {any} schema - The JSON schema object.
 * @returns {any} The modified schema with `additionalProperties: false` added to all objects.
 */
export function addAdditionalPropertiesFalse(schema: any): any {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }
    
    const result = { ...schema };
    
    if (result.type === 'object') {
        result.additionalProperties = false;
        
        if (result.required && result.properties) {
            const propertyKeys = Object.keys(result.properties);
            result.required = result.required.filter((key: string) => propertyKeys.includes(key));
        }
    }
    
    if (result.properties) {
        const newProperties: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(result.properties)) {
            newProperties[key] = addAdditionalPropertiesFalse(value);
        }
        result.properties = newProperties;
    }
    
    if (result.items) {
        result.items = addAdditionalPropertiesFalse(result.items);
    }
    
    return result;
}

/**
 * Converts an OpenAI-style JSON schema into the format required by Google's Gemini API.
 *
 * @param {any} openaiSchema - The JSON schema in OpenAI format.
 * @returns {any} The converted schema in Gemini format.
 */
export function convertOpenAISchemaToGemini(openaiSchema: any): any {
    if (!openaiSchema || !openaiSchema.schema) {
        return {};
    }
    
    const schema = openaiSchema.schema;
    
    function convertType(type: string): any {
        switch (type) {
            case 'string': return { type: 'STRING' };
            case 'number': return { type: 'NUMBER' };
            case 'integer': return { type: 'INTEGER' };
            case 'boolean': return { type: 'BOOLEAN' };
            case 'array': return { type: 'ARRAY' };
            case 'object': return { type: 'OBJECT' };
            default: return { type: 'STRING' };
        }
    }
    
    function convertSchema(obj: any): any {
        if (!obj) return {};
        
        const result: any = {};
        
        if (obj.type) {
            Object.assign(result, convertType(obj.type));
        }
        
        if (obj.properties) {
            result.properties = {};
            for (const [key, value] of Object.entries(obj.properties)) {
                result.properties[key] = convertSchema(value);
            }
        }
        
        if (obj.items) {
            result.items = convertSchema(obj.items);
        }
        
        if (obj.required) result.required = obj.required;
        if (obj.description) result.description = obj.description;
        
        return result;
    }
    
    return convertSchema(schema);
}

/**
 * Maps generic, OpenAI-compatible model names (like 'gpt-4') to specific model IDs
 * for the target provider. This allows users to use common names while the worker
 * routes to the best available equivalent model.
 *
 * @param {string} model - The model name from the request.
 * @param {Provider} provider - The target provider.
 * @param {Env} env - The worker's environment, containing default model settings.
 * @returns {string} The mapped, provider-specific model name.
 */
export function mapModelName(model: string, provider: Provider, env: Env): string {
    if (provider === 'cloudflare') {
        const map: Record<string, string> = {
            'gpt-4': env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
            'gpt-4-turbo': env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
            'gpt-4o': env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
            'gpt-3.5-turbo': env.BACKUP_MODEL || '@cf/openai/gpt-oss-120b',
        };
        return map[model] || model;
    }
    if (provider === 'gemini') {
        const map: Record<string, string> = {
            'gpt-4': 'gemini-1.5-pro',
            'gpt-4o': 'gemini-1.5-pro',
            'gpt-3.5-turbo': 'gemini-1.5-flash',
        };
        return map[model] || model;
    }
    return model;
}

/**
 * Converts an array of OpenAI-style chat messages into the format required by the target provider and model type.
 * Some models, especially older ones on Cloudflare, require a single formatted string instead of a message array.
 *
 * @param {ChatMessage[]} messages - The array of chat messages.
 * @param {Provider} provider - The target provider.
 * @param {ModelType} modelType - The specific type of the model.
 * @returns {ChatMessage[] | { input: string }} The converted messages, either as an array or a single input object.
 */
export function convertMessages(messages: ChatMessage[], provider: Provider, modelType: ModelType): ChatMessage[] | { input: string } {
    if (provider === 'openai' || provider === 'gemini' || (provider === 'cloudflare' && modelType === 'llama4')) {
        return messages;
    }

    if (provider === 'cloudflare' && modelType === 'llama') {
        const input = messages.map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`).join('\n');
        return { input };
    }
    
    const prompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    return { input: prompt };
}

// --- Model Fetching Functions ---

/**
 * Fetches the list of available text generation models from Cloudflare.
 * It first tries to fetch from a configured Core API service binding, and if that fails,
 * it falls back to a hardcoded list of popular models.
 *
 * @param {Env} env - The worker's environment.
 * @returns {Promise<ApiModel[]>} A promise that resolves to an array of Cloudflare models.
 */
export async function getCloudflareModels(env: Env): Promise<ApiModel[]> {
    try {
        if (env.CORE_API && env.CORE_WORKER_API_KEY) {
            const resp = await env.CORE_API.fetch('https://core-api.hacolby.workers.dev/ai/models', {
                headers: { 'X-API-Key': env.CORE_WORKER_API_KEY, 'Content-Type': 'application/json' },
            });

            if (resp.ok) {
                const data = (await resp.json()) as CloudflareAIModelsResponse;
                const models: ApiModel[] = [];
                for (const [providerName, providerModels] of Object.entries(data.providers || {})) {
                    for (const m of providerModels || []) {
                        if ((m.task?.name || '').toLowerCase().includes('text')) {
                            models.push({
                                id: m.name || m.id,
                                object: 'model',
                                owner: `cloudflare-${providerName}`,
                                created: m.created_at ? Date.parse(m.created_at) / 1000 : undefined,
                            });
                        }
                    }
                }
                if (models.length > 0) {
                    debugLog(env, `Loaded ${models.length} Cloudflare models from core API`);
                    return models;
                }
            }
            else {
                errorLog(`Core API /ai/models ${resp.status}`, await resp.text());
            }
        }
    }
    catch (err) {
        errorLog('Failed to fetch Cloudflare models from Core API', err);
    }

    debugLog(env, 'Using fallback Cloudflare models list');
    return [
        { id: '@cf/meta/llama-4-scout-17b-16e-instruct', object: 'model', owner: 'cloudflare-meta' },
        { id: '@cf/meta/llama-3-8b-instruct', object: 'model', owner: 'cloudflare-meta' },
        { id: '@cf/meta/llama-3-70b-instruct', object: 'model', owner: 'cloudflare-meta' },
        { id: '@cf/openai/gpt-oss-120b', object: 'model', owner: 'cloudflare-openai' },
        { id: '@cf/google/gemma-7b-it', object: 'model', owner: 'cloudflare-google' },
    ];
}

/**
 * Fetches the list of available GPT models from the OpenAI API.
 *
 * @param {Env} env - The worker's environment, containing the `OPENAI_API_KEY`.
 * @returns {Promise<ApiModel[]>} A promise that resolves to an array of OpenAI models. Returns an empty array if the key is not configured or the fetch fails.
 */
export async function getOpenAIModels(env: Env): Promise<ApiModel[]> {
    if (!env.OPENAI_API_KEY) return [];
    try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const models = await openai.models.list();
        return models.data
            .filter(m => {
                // Filter for chat models using the same logic as our script
                const isChatModel = m.id.includes('gpt') || m.id.includes('o1');
                return isChatModel;
            })
            .map(m => ({ id: m.id, object: 'model', owner: 'openai', created: m.created }));
    }
    catch (error) {
        debugLog(env, 'Could not fetch OpenAI models', { error: (error as Error).message });
        return [];
    }
}

/**
 * Fetches the list of available text generation models from the Google Gemini API.
 * Only returns models that support 'generateContent' action.
 *
 * @param {Env} env - The worker's environment, containing the `GEMINI_API_KEY`.
 * @returns {Promise<ApiModel[]>} A promise that resolves to an array of Gemini models. Returns an empty array if the key is not configured or the fetch fails.
 */
export async function getGeminiModels(env: Env): Promise<ApiModel[]> {
    if (!env.GEMINI_API_KEY) return [];
    try {
        const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        const modelsPager = await genAI.models.list();
        
        // Convert pager to array
        const models: any[] = [];
        for await (const model of modelsPager) {
            models.push(model);
        }
        
        return models
            .filter((m: any) => 
                m.supportedActions?.includes('generateContent') && 
                !m.description?.toLowerCase().includes('vertex')
            )
            .map((m: any) => ({
                id: m.name?.replace('models/', '') || '',
                object: 'model',
                owner: 'google',
                created: m.createTime ? new Date(m.createTime).getTime() / 1000 : undefined
            }));
    }
    catch (error) {
        debugLog(env, 'Could not fetch Gemini models', { error: (error as Error).message });
        return [];
    }
}