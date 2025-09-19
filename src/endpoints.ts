
import { getCloudflareModels, getGeminiModels, getOpenAIModels } from './models';
import { ApiModel, CompletionRequestBody } from './types';
import { errorLog } from './utils';
import { handleChatCompletions } from './routing';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { CloudflareAIModelsResponse } from './types';

export async function handleModelsRequest(_request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const [cloudflareModels, openaiModels, geminiModels] = await Promise.all([
            getCloudflareModels(env),
            getOpenAIModels(env),
            getGeminiModels(env)
        ]);

        let allModels: ApiModel[] = [...cloudflareModels, ...openaiModels, ...geminiModels];

        const compatibilityModels: ApiModel[] = [
            { id: 'gpt-4', object: 'model', owner: 'openai-compat' },
            { id: 'gpt-4o', object: 'model', owner: 'openai-compat' },
            { id: 'gpt-3.5-turbo', object: 'model', owner: 'openai-compat' },
        ];

        allModels = [...compatibilityModels, ...allModels];
        const uniqueModels = Array.from(new Map(allModels.map(m => [m.id, m])).values());

        return new Response(JSON.stringify({ data: uniqueModels, object: 'list' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        errorLog('Error fetching models', error);
        return new Response(JSON.stringify({ error: { message: 'Failed to fetch models', type: 'server_error' } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function handleCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const body = await request.json() as CompletionRequestBody;
    if (!body.prompt) {
        return new Response(JSON.stringify({ error: { message: '`prompt` parameter is required', type: 'invalid_request_error' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
    
    const chatRequest = new Request(request.url.replace('/completions', '/chat/completions'), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
            model: body.model,
            messages: [{ role: 'user', content: body.prompt }],
            max_tokens: body.max_tokens,
            temperature: body.temperature,
            stream: body.stream
        })
    });
    
    return handleChatCompletions(chatRequest, env, corsHeaders);
}

export async function handleTestAPIs(_request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const results = {
        timestamp: new Date().toISOString(),
        tests: {
            coreApi: { status: 'PENDING', message: '', models: 0, providers: 0 },
            openai: { status: 'PENDING', message: '', models: 0 },
            gemini: { status: 'PENDING', message: '', models: 0 },
            cloudflareAI: { status: 'PENDING', message: '', models: 0 }
        }
    };

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
                const data = await resp.json() as CloudflareAIModelsResponse;
                const totalModels = Object.values(data.providers || {}).flat().length;
                const providers = Object.keys(data.providers || {}).length;
                
                results.tests.coreApi = {
                    status: 'PASS',
                    message: `Successfully connected to Core API`,
                    models: totalModels,
                    providers: providers
                };
            } else {
                const errorText = await resp.text();
                results.tests.coreApi = {
                    status: 'FAIL',
                    message: `Core API returned ${resp.status}: ${errorText}`,
                    models: 0,
                    providers: 0
                };
            }
        } else {
            results.tests.coreApi = {
                status: 'FAIL',
                message: 'Core API not configured (missing CORE_API or CORE_WORKER_API_KEY)',
                models: 0,
                providers: 0
            };
        }
    } catch (error) {
        results.tests.coreApi = {
            status: 'FAIL',
            message: `Core API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            models: 0,
            providers: 0
        };
    }

    try {
        if (env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
            const models = await openai.models.list();
            const gptModels = models.data.filter(m => m.id.includes('gpt')).length;
            
            results.tests.openai = {
                status: 'PASS',
                message: `Successfully connected to OpenAI API`,
                models: gptModels
            };
        } else {
            results.tests.openai = {
                status: 'FAIL',
                message: 'OpenAI API key not configured',
                models: 0
            };
        }
    } catch (error) {
        results.tests.openai = {
            status: 'FAIL',
            message: `OpenAI error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            models: 0
        };
    }

    try {
        if (env.GEMINI_API_KEY) {
            const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
            const models = await genAI.getGenerativeModel({ model: "gemini-pro" }).listModels();
            const textModels = Array.isArray(models) ? models.filter((m: any) => 
                Array.isArray(m.supportedGenerationMethods) && 
                m.supportedGenerationMethods.includes('generateContent')
            ).length : 0;
            
            results.tests.gemini = {
                status: 'PASS',
                message: `Successfully connected to Gemini API`,
                models: textModels
            };
        } else {
            results.tests.gemini = {
                status: 'FAIL',
                message: 'Gemini API key not configured',
                models: 0
            };
        }
    } catch (error) {
        results.tests.gemini = {
            status: 'FAIL',
            message: `Gemini error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            models: 0
        };
    }

    try {
        if (env.AI) {
            await env.AI.run('@cf/meta/llama-3-8b-instruct', {
                messages: [{ role: 'user', content: 'Hello' }]
            });
            
            results.tests.cloudflareAI = {
                status: 'PASS',
                message: `Successfully connected to Cloudflare AI binding`,
                models: 1
            };
        } else {
            results.tests.cloudflareAI = {
                status: 'FAIL',
                message: 'Cloudflare AI binding not configured',
                models: 0
            };
        }
    } catch (error) {
        results.tests.cloudflareAI = {
            status: 'FAIL',
            message: `Cloudflare AI error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            models: 0
        };
    }

    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}
