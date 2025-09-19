/**
 * @file src/endpoints.ts
 * @description This file contains the handlers for the non-chat API endpoints,
 *              such as `/v1/models`, `/v1/completions`, and a custom `/test/apis` endpoint.
 *              These handlers are responsible for fetching model lists, converting legacy
 *              completion requests to chat requests, and running diagnostic tests on the
 *              configured API providers.
 */

import { getCloudflareModels, getGeminiModels, getOpenAIModels } from './models';
import type { ApiModel, CompletionRequestBody, CloudflareAIModelsResponse, ChatCompletionRequestBody } from './types';
import { errorLog } from './utils';
import { handleChatCompletions } from './routing';
import { saveMemoryContext } from './memory';
import { GoogleGenAI } from '@google/genai';

import OpenAI from 'openai';

/**
 * Handles requests to the `/v1/models` endpoint.
 * It aggregates model lists from all configured providers (Cloudflare, OpenAI, Gemini)
 * and returns a unified list in the OpenAI API format. It also includes compatibility
 * models like 'gpt-4' to ensure broad client support.
 *
 * @param {Request} _request - The incoming request (not used).
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} A response containing the list of all available models.
 */
export async function handleModelsRequest(_request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const [cloudflareModels, openaiModels, geminiModels] = await Promise.all([
            getCloudflareModels(env),
            getOpenAIModels(env),
            getGeminiModels(env)
        ]);

        let allModels: ApiModel[] = [...cloudflareModels, ...openaiModels, ...geminiModels];

        // Add common compatibility names to the list for clients that expect them.
        const compatibilityModels: ApiModel[] = [
            { id: 'gpt-4', object: 'model', owner: 'openai-compat' },
            { id: 'gpt-4o', object: 'model', owner: 'openai-compat' },
            { id: 'gpt-3.5-turbo', object: 'model', owner: 'openai-compat' },
        ];

        allModels = [...compatibilityModels, ...allModels];
        // De-duplicate the list based on model ID.
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

/**
 * Handles requests to the legacy `/v1/completions` endpoint.
 * It converts the prompt-based request into the chat-based message format and
 * forwards it to the `handleChatCompletions` handler. This ensures backward
 * compatibility with older clients.
 *
 * @param {Request} request - The incoming request.
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} The response from the `handleChatCompletions` handler.
 */
export async function handleCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const body = await request.json() as CompletionRequestBody;
    if (!body.prompt) {
        return new Response(JSON.stringify({ error: { message: '`prompt` parameter is required', type: 'invalid_request_error' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
    
    // Transform the legacy request into a modern chat completion request.
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

/**
 * Handles requests to the custom `/test/apis` endpoint.
 * This endpoint runs a series of checks to verify the configuration and connectivity
 * of all backend API providers (Core API, OpenAI, Gemini, Cloudflare AI binding).
 * It returns a JSON report with the status of each test.
 *
 * @param {Request} _request - The incoming request (not used).
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} A JSON response containing the test results.
 */
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

    // Test Core API for Cloudflare model fetching
    try {
        if (env.CORE_API && env.CORE_WORKER_API_KEY) {
            const resp = await env.CORE_API.fetch('https://core-api.hacolby.workers.dev/ai/models', {
                headers: { 'X-API-Key': env.CORE_WORKER_API_KEY, 'Content-Type': 'application/json' },
            });
            if (resp.ok) {
                const data = await resp.json() as CloudflareAIModelsResponse;
                results.tests.coreApi = {
                    status: 'PASS', message: `Successfully connected to Core API`,
                    models: Object.values(data.providers || {}).flat().length,
                    providers: Object.keys(data.providers || {}).length
                };
            } else {
                results.tests.coreApi = { status: 'FAIL', message: `Core API returned ${resp.status}: ${await resp.text()}`, models: 0, providers: 0 };
            }
        } else {
            results.tests.coreApi = { status: 'FAIL', message: 'Core API not configured', models: 0, providers: 0 };
        }
    } catch (e) {
        results.tests.coreApi = { status: 'FAIL', message: `Core API error: ${(e as Error).message}`, models: 0, providers: 0 };
    }

    // Test OpenAI API
    try {
        if (env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
            const models = await openai.models.list();
            results.tests.openai = { status: 'PASS', message: `Successfully connected to OpenAI API`, models: models.data.filter(m => m.id.includes('gpt')).length };
        } else {
            results.tests.openai = { status: 'FAIL', message: 'OpenAI API key not configured', models: 0 };
        }
    } catch (e) {
        results.tests.openai = { status: 'FAIL', message: `OpenAI error: ${(e as Error).message}`, models: 0 };
    }

    // Test Gemini API
    try {
        if (env.GEMINI_API_KEY) {
            const genAI = new GoogleGenAI({apiKey: env.GEMINI_API_KEY});
            const modelsPager = await genAI.models.list();
            const models: any[] = [];
            for await (const model of modelsPager) {
                models.push(model);
            }
            results.tests.gemini = { status: 'PASS', message: `Successfully connected to Gemini API`, models: models.filter((m: any) => m.supportedActions?.includes('generateContent')).length };
        } else {
            results.tests.gemini = { status: 'FAIL', message: 'Gemini API key not configured', models: 0 };
        }
    } catch (e) {
        results.tests.gemini = { status: 'FAIL', message: `Gemini error: ${(e as Error).message}`, models: 0 };
    }

    // Test Cloudflare AI Binding
    try {
        if (env.AI) {
            await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: [{ role: 'user', content: 'Hello' }] });
            results.tests.cloudflareAI = { status: 'PASS', message: `Successfully connected to Cloudflare AI binding`, models: 1 };
        } else {
            results.tests.cloudflareAI = { status: 'FAIL', message: 'Cloudflare AI binding not configured', models: 0 };
        }
    } catch (e) {
        results.tests.cloudflareAI = { status: 'FAIL', message: `Cloudflare AI error: ${(e as Error).message}`, models: 0 };
    }

    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

/**
 * Handles requests to the `/v1/completions/withmemory` endpoint.
 * This endpoint requires both `memory: true` and `memory_keyword` to be provided.
 * It converts the prompt-based request into the chat-based message format and
 * forwards it to the `handleChatCompletions` handler with memory functionality enabled.
 * After getting the response, it saves the conversation context to KV storage.
 *
 * @param {Request} request - The incoming request.
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} The response from the `handleChatCompletions` handler.
 */
export async function handleCompletionsWithMemory(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        
        // Validate required parameters for memory functionality
        if (!body.memory) {
            return new Response(JSON.stringify({ 
                error: { 
                    message: '`memory` parameter must be set to true for this endpoint', 
                    type: 'invalid_request_error' 
                } 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        if (!body.memory_keyword) {
            return new Response(JSON.stringify({ 
                error: { 
                    message: '`memory_keyword` parameter is required when memory is enabled', 
                    type: 'invalid_request_error' 
                } 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // If it's a legacy completion request (has prompt), convert it to chat format
        if ('prompt' in body && body.prompt) {
            const chatRequest = new Request(request.url.replace('/completions/withmemory', '/chat/completions'), {
                method: 'POST',
                headers: request.headers,
                body: JSON.stringify({
                    model: body.model,
                    messages: [{ role: 'user', content: body.prompt }],
                    max_tokens: body.max_tokens,
                    temperature: body.temperature,
                    stream: body.stream,
                    memory: true,
                    memory_keyword: body.memory_keyword
                })
            });
            
            const response = await handleChatCompletions(chatRequest, env, corsHeaders);
            
            // Save memory context if the response was successful
            if (response.ok) {
                try {
                    const responseData = await response.clone().json() as any;
                    const assistantMessage = responseData.choices?.[0]?.message?.content || '';
                    if (assistantMessage) {
                        await saveMemoryContext(
                            [{ role: 'user', content: body.prompt }], 
                            assistantMessage, 
                            body.memory_keyword, 
                            env
                        );
                    }
                } catch (error) {
                    errorLog('Error saving memory context', error);
                    // Don't fail the request if memory saving fails
                }
            }
            
            return response;
        }
        
        // If it's already a chat completion request, forward it directly
        const chatRequest = new Request(request.url.replace('/completions/withmemory', '/chat/completions'), {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(body)
        });
        
        const response = await handleChatCompletions(chatRequest, env, corsHeaders);
        
        // Save memory context if the response was successful
        if (response.ok && body.messages) {
            try {
                const responseData = await response.clone().json() as any;
                const assistantMessage = responseData.choices?.[0]?.message?.content || '';
                if (assistantMessage) {
                    await saveMemoryContext(
                        body.messages, 
                        assistantMessage, 
                        body.memory_keyword, 
                        env
                    );
                }
            } catch (error) {
                errorLog('Error saving memory context', error);
                // Don't fail the request if memory saving fails
            }
        }
        
        return response;
        
    } catch (error) {
        errorLog('Error in handleCompletionsWithMemory', error);
        return new Response(JSON.stringify({ 
            error: { 
                message: 'Internal server error', 
                type: 'server_error',
                details: error instanceof Error ? error.message : 'Unknown error'
            } 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}