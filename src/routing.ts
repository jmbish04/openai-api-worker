/**
 * @file src/routing.ts
 * @description This file contains the core routing logic for chat completion requests.
 *              It acts as a central dispatcher that receives a request, determines the
 *              appropriate backend provider (Cloudflare, OpenAI, Gemini) based on the
 *              model name, and forwards the request to the corresponding handler.
 *              It handles different types of chat completion endpoints, including
 *              standard, structured (JSON), and text-only.
 */

import type { ChatCompletionRequestBody } from './types';
import { debugLog, errorLog } from './utils';
import { addMemoryContext, saveMemoryContext } from './memory';
import { detectProvider, getModelType, mapModelName } from './models';
import { handleOpenAIRequest, handleOpenAIStructuredRequest, handleOpenAITextRequest } from './handlers/openai';
import { handleGeminiRequest, handleGeminiStructuredRequest, handleGeminiTextRequest } from './handlers/gemini';
import { handleCloudflareTextRequest, handleCloudflareStructuredRequest } from './handlers/cloudflare';
import { supportsStructuredOutputs, getAvailableStructuredModels } from './handlers/model-info';

/**
 * Validates if a model supports structured outputs and returns an error response if not.
 * 
 * @param {string} model - The model name to validate
 * @param {string} provider - The detected provider
 * @returns {Response | null} Error response if validation fails, null if valid
 */
function validateStructuredModel(model: string, provider: string): Response | null {
    if (!supportsStructuredOutputs(model, provider as 'openai' | 'gemini' | 'cloudflare')) {
        const availableModels = getAvailableStructuredModels(provider as 'openai' | 'gemini' | 'cloudflare');
        
        const errorMessage = {
            error: {
                message: `Model '${model}' does not support structured outputs. Please use one of the following supported models:`,
                type: 'invalid_request_error',
                code: 'unsupported_model',
                available_models: availableModels,
                provider: provider
            }
        };
        
        return new Response(JSON.stringify(errorMessage), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return null;
}

/**
 * Handles standard chat completion requests for the `/v1/chat/completions` endpoint.
 *
 * This function performs the following steps:
 * 1.  Parses and validates the request body.
 * 2.  Determines the target provider and maps the model name.
 * 3.  Retrieves and adds conversation history from KV memory if a `memory_keyword` is provided.
 * 4.  Constructs a comprehensive parameters object for the provider handler.
 * 5.  Calls the appropriate provider-specific handler (`handleOpenAIRequest`, `handleGeminiRequest`, etc.).
 * 6.  Returns the response from the handler, or a formatted error response if something goes wrong.
 *
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers to include in the response.
 * @returns {Promise<Response>} A promise that resolves to the response to be sent to the client.
 */
export async function handleChatCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        const { model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct', messages, memory, memory_keyword, ...rest } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { message: '`messages` parameter is required and must be an array', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Validate memory parameters if memory is enabled
        if (memory && !memory_keyword) {
            return new Response(JSON.stringify({ error: { message: '`memory_keyword` is required when `memory` is true', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const provider = detectProvider(model, env);
        const mappedModel = mapModelName(model, provider, env);
        const modelType = getModelType(mappedModel, provider);
        debugLog(env, `Routing to provider`, { provider, model: mappedModel, type: modelType, memory });

        const messagesWithMemory = memory_keyword ? await addMemoryContext(messages, memory_keyword, env) : messages;

        const handlerParams = { messages: messagesWithMemory, model: mappedModel, memory, memory_keyword, modelType, originalModel: model, ...rest };

        const response = await (() => {
            switch (provider) {
                case 'openai': return handleOpenAIRequest(handlerParams, env, corsHeaders);
                case 'gemini': return handleGeminiRequest(handlerParams, env, corsHeaders);
                case 'cloudflare':
                default: return handleCloudflareTextRequest(handlerParams, env, corsHeaders);
            }
        })();

        // Save memory context if memory is enabled and response is successful
        if (memory && memory_keyword && response.ok) {
            try {
                const responseData = await response.clone().json() as any;
                const assistantMessage = responseData.choices?.[0]?.message?.content || '';
                if (assistantMessage) {
                    await saveMemoryContext(messages, assistantMessage, memory_keyword, env);
                }
            } catch (error) {
                errorLog('Error saving memory context', error);
                // Don't fail the request if memory saving fails
            }
        }

        return response;
    } catch (error) {
        errorLog('Chat completions error', error);
        return new Response(JSON.stringify({ error: { message: 'AI service error', type: 'server_error', details: (error as Error).message } }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

/**
 * Handles requests for structured (JSON) chat completions to the `/v1/chat/completions/structured` endpoint.
 * This is similar to `handleChatCompletions` but ensures that a `response_format.schema` is present.
 *
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers.
 * @returns {Promise<Response>} A promise resolving to the response.
 */
export async function handleStructuredChatCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        const { model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct', messages, response_format, memory, memory_keyword, ...rest } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { message: '`messages` is required', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        if (!response_format || !response_format.schema) {
            return new Response(JSON.stringify({ error: { message: '`response_format.schema` is required', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Validate memory parameters if memory is enabled
        if (memory && !memory_keyword) {
            return new Response(JSON.stringify({ error: { message: '`memory_keyword` is required when `memory` is true', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const provider = detectProvider(model, env);
        const mappedModel = mapModelName(model, provider, env);
        const modelType = getModelType(mappedModel, provider);
        debugLog(env, `Routing structured request to provider`, { provider, model: mappedModel, type: modelType, memory });

        // Validate that the model supports structured outputs
        const validationError = validateStructuredModel(mappedModel, provider);
        if (validationError) {
            return validationError;
        }

        const messagesWithMemory = memory_keyword ? await addMemoryContext(messages, memory_keyword, env) : messages;

        const handlerParams = { messages: messagesWithMemory, model: mappedModel, response_format, memory, memory_keyword, modelType, originalModel: model, ...rest };

        const response = await (() => {
            switch (provider) {
                case 'openai': return handleOpenAIStructuredRequest(handlerParams, env, corsHeaders);
                case 'gemini': return handleGeminiStructuredRequest(handlerParams, env, corsHeaders);
                case 'cloudflare':
                default: return handleCloudflareStructuredRequest(handlerParams, env, corsHeaders);
            }
        })();

        // Save memory context if memory is enabled and response is successful
        if (memory && memory_keyword && response.ok) {
            try {
                const responseData = await response.clone().json() as any;
                const assistantMessage = responseData.choices?.[0]?.message?.content || '';
                if (assistantMessage) {
                    await saveMemoryContext(messages, assistantMessage, memory_keyword, env);
                }
            } catch (error) {
                errorLog('Error saving memory context', error);
                // Don't fail the request if memory saving fails
            }
        }

        return response;
    } catch (error) {
        errorLog('Structured chat completions error', error);
        return new Response(JSON.stringify({ error: { message: 'AI service error', type: 'server_error', details: (error as Error).message } }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

/**
 * Handles requests for text-only chat completions to the `/v1/chat/completions/text` endpoint.
 * This is a convenience endpoint that follows the same logic as `handleChatCompletions`.
 *
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - The worker's environment.
 * @param {Record<string, string>} corsHeaders - CORS headers.
 * @returns {Promise<Response>} A promise resolving to the response.
 */
export async function handleTextChatCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        const { model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct', messages, memory, memory_keyword, ...rest } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { message: '`messages` is required', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Validate memory parameters if memory is enabled
        if (memory && !memory_keyword) {
            return new Response(JSON.stringify({ error: { message: '`memory_keyword` is required when `memory` is true', type: 'invalid_request_error' } }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const provider = detectProvider(model, env);
        const mappedModel = mapModelName(model, provider, env);
        const modelType = getModelType(mappedModel, provider);
        debugLog(env, `Routing text request to provider`, { provider, model: mappedModel, type: modelType, memory });

        const messagesWithMemory = memory_keyword ? await addMemoryContext(messages, memory_keyword, env) : messages;

        const handlerParams = { messages: messagesWithMemory, model: mappedModel, memory, memory_keyword, modelType, originalModel: model, ...rest };

        const response = await (() => {
            switch (provider) {
                case 'openai': return handleOpenAITextRequest(handlerParams, env, corsHeaders);
                case 'gemini': return handleGeminiTextRequest(handlerParams, env, corsHeaders);
                case 'cloudflare':
                default: return handleCloudflareTextRequest(handlerParams, env, corsHeaders);
            }
        })();

        // Save memory context if memory is enabled and response is successful
        if (memory && memory_keyword && response.ok) {
            try {
                const responseData = await response.clone().json() as any;
                const assistantMessage = responseData.choices?.[0]?.message?.content || '';
                if (assistantMessage) {
                    await saveMemoryContext(messages, assistantMessage, memory_keyword, env);
                }
            } catch (error) {
                errorLog('Error saving memory context', error);
                // Don't fail the request if memory saving fails
            }
        }

        return response;
    } catch (error) {
        errorLog('Text chat completions error', error);
        return new Response(JSON.stringify({ error: { message: 'AI service error', type: 'server_error', details: (error as Error).message } }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}