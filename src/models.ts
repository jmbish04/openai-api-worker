import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { ApiModel, ChatMessage, CloudflareAIModelsResponse, ModelType, Provider } from './types';
import { debugLog, errorLog } from './utils';

export function detectProvider(model: string, env: Env): Provider {
    const m = model.toLowerCase();
    if (m.startsWith('@cf/')) return 'cloudflare';
    if (m.includes('gpt')) return 'openai';
    if (m.includes('gemini') || m.includes('bison')) return 'gemini';
    if (env.OPENAI_API_KEY && (m === 'gpt-4' || m === 'gpt-3.5-turbo')) return 'openai';
    return 'cloudflare';
}

export function getModelType(model: string, provider: Provider): ModelType {
    if (provider === 'cloudflare') {
        const m = model.toLowerCase();
        if (m.includes('llama-4')) return 'llama4';
        if (m.includes('llama')) return 'llama';
        if (m.includes('openai') || m.includes('gpt-oss')) return 'openai';
    }
    if (provider === 'openai') return 'openai';
    if (provider === 'gemini') return 'gemini';
    return 'input';
}

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
        result.properties = {};
        for (const [key, value] of Object.entries(result.properties)) {
            result.properties[key] = addAdditionalPropertiesFalse(value);
        }
    }
    
    if (result.items) {
        result.items = addAdditionalPropertiesFalse(result.items);
    }
    
    return result;
}

export function convertOpenAISchemaToGemini(openaiSchema: any): any {
    if (!openaiSchema || !openaiSchema.schema) {
        return {};
    }
    
    const schema = openaiSchema.schema;
    
    function convertType(type: string): any {
        switch (type) {
            case 'string':
                return { type: 'STRING' };
            case 'number':
                return { type: 'NUMBER' };
            case 'integer':
                return { type: 'INTEGER' };
            case 'boolean':
                return { type: 'BOOLEAN' };
            case 'array':
                return { type: 'ARRAY' };
            case 'object':
                return { type: 'OBJECT' };
            default:
                return { type: 'STRING' };
        }
    }
    
    function convertSchema(obj: any): any {
        if (!obj) return {};
        
        const result: any = {};
        
        if (obj.type) {
            const converted = convertType(obj.type);
            Object.assign(result, converted);
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
        
        if (obj.required) {
            result.required = obj.required;
        }
        
        if (obj.description) {
            result.description = obj.description;
        }
        
        return result;
    }
    
    return convertSchema(schema);
}

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

export function convertMessages(messages: ChatMessage[], provider: Provider, modelType: ModelType): ChatMessage[] | { input: string } {
    if (provider === 'openai' || provider === 'gemini' || (provider === 'cloudflare' && modelType === 'llama4')) {
        return messages;
    }

    if (provider === 'cloudflare') {
        if (modelType === 'llama') {
            const input = messages.map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`).join('\n');
            return { input };
        }
    }
    
    const prompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    return { input: prompt };
}

export async function getCloudflareModels(env: Env): Promise<ApiModel[]> {
    try {
        if (env.CORE_API && env.CORE_WORKER_API_KEY) {
            const resp = await env.CORE_API.fetch('https://core-api.hacolby.workers.dev/ai/models', {
                method: 'GET',
                headers: {
                    'X-API-Key': env.CORE_WORKER_API_KEY,
                    'Content-Type': 'application/json',
                },
            });

            if (resp.ok) {
                const data = (await resp.json()) as CloudflareAIModelsResponse;

                const models: ApiModel[] = [];
                for (const [providerName, providerModels] of Object.entries(data.providers || {})) {
                    for (const m of providerModels || []) {
                        const taskName = (m.task?.name || '').toLowerCase();
                        if (taskName.includes('text') && taskName.includes('gen')) {
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
            } else {
                const t = await resp.text();
                errorLog(`Core API /ai/models ${resp.status}`, t);
            }
        }

        debugLog(env, 'Using fallback Cloudflare models list');
        return [
            { id: '@cf/meta/llama-4-scout-17b-16e-instruct', object: 'model', owner: 'cloudflare-meta' },
            { id: '@cf/meta/llama-3-8b-instruct', object: 'model', owner: 'cloudflare-meta' },
            { id: '@cf/meta/llama-3-70b-instruct', object: 'model', owner: 'cloudflare-meta' },
            { id: '@cf/openai/gpt-oss-120b', object: 'model', owner: 'cloudflare-openai' },
            { id: '@cf/google/gemma-7b-it', object: 'model', owner: 'cloudflare-google' },
            { id: '@cf/google/gemma-2-9b-it', object: 'model', owner: 'cloudflare-google' },
            { id: '@cf/microsoft/phi-3-mini-128k-instruct', object: 'model', owner: 'cloudflare-microsoft' },
            { id: '@cf/huggingface/microsoft/DialoGPT-medium', object: 'model', owner: 'cloudflare-huggingface' },
            { id: '@cf/qwen/qwen-2.5-7b-instruct', object: 'model', owner: 'cloudflare-qwen' },
            { id: '@cf/cohere/command-r-plus', object: 'model', owner: 'cloudflare-cohere' },
        ];
    } catch (err) {
        errorLog('Failed to fetch Cloudflare models', err);
        return [
            { id: '@cf/meta/llama-4-scout-17b-16e-instruct', object: 'model', owner: 'cloudflare-meta' },
            { id: '@cf/meta/llama-3-8b-instruct', object: 'model', owner: 'cloudflare-meta' },
            { id: '@cf/openai/gpt-oss-120b', object: 'model', owner: 'cloudflare-openai' },
            { id: '@cf/google/gemma-7b-it', object: 'model', owner: 'cloudflare-google' },
            { id: '@cf/microsoft/phi-3-mini-128k-instruct', object: 'model', owner: 'cloudflare-microsoft' },
        ];
    }
}

export async function getOpenAIModels(env: Env): Promise<ApiModel[]> {
    if (!env.OPENAI_API_KEY) return [];
    try {
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const models = await openai.models.list();
        return models.data
            .filter(m => m.id.includes('gpt'))
            .map(m => ({ id: m.id, object: 'model', owner: 'openai', created: m.created }));
    } catch (error) {
        debugLog(env, 'Could not fetch OpenAI models', { error: (error as Error).message });
        return [];
    }
}

export async function getGeminiModels(env: Env): Promise<ApiModel[]> {
    if (!env.GEMINI_API_KEY) return [];
    try {
        const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        const models = await genAI.getGenerativeModel({ model: "gemini-pro" }).listModels();
        if (!Array.isArray(models)) return [];
        return models
            .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
            .map((m: any) => ({
                id: typeof m.name === 'string' ? m.name.replace('models/', '') : '',
                object: 'model',
                owner: 'google',
                created: m.createTime ? new Date(m.createTime).getTime() / 1000 : undefined
            }));
    } catch (error) {
        debugLog(env, 'Could not fetch Gemini models', { error: (error as Error).message });
        return [];
    }
}
