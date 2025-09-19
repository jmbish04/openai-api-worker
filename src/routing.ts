
import { ChatCompletionRequestBody } from './types';
import { debugLog, errorLog } from './utils';
import { addMemoryContext } from './memory';
import { detectProvider, getModelType, mapModelName } from './models';
import { handleOpenAIRequest, handleOpenAIStructuredRequest, handleOpenAITextRequest } from './handlers/openai';
import { handleGeminiRequest, handleGeminiStructuredRequest, handleGeminiTextRequest } from './handlers/gemini';
import { handleCloudflareRequest, handleCloudflareStructuredRequest, handleCloudflareTextRequest } from './handlers/cloudflare';

export async function handleChatCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        const {
            model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
            messages,
            stream = false,
            max_tokens = 2048,
            temperature = 0.7,
            top_p = 1,
            frequency_penalty = 0,
            presence_penalty = 0,
            response_format,
            memory_keyword,
            ...otherParams
        } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { message: '`messages` parameter is required and must be an array', type: 'invalid_request_error' } }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const provider = detectProvider(model, env);
        const mappedModel = mapModelName(model, provider, env);
        const modelType = getModelType(mappedModel, provider);
        debugLog(env, `Routing to provider`, { provider, model: mappedModel, type: modelType });

        const messagesWithMemory = memory_keyword ? await addMemoryContext(messages, memory_keyword, env) : messages;

        const handlerParams = {
            messages: messagesWithMemory,
            model: mappedModel,
            stream,
            max_tokens,
            temperature,
            top_p,
            frequency_penalty,
            presence_penalty,
            response_format,
            memory_keyword,
            ...otherParams,
            modelType,
            originalModel: model
        };

        switch (provider) {
            case 'openai':
                return handleOpenAIRequest(handlerParams, env, corsHeaders);
            case 'gemini':
                return handleGeminiRequest(handlerParams, env, corsHeaders);
            case 'cloudflare':
            default:
                return handleCloudflareRequest(handlerParams, env, corsHeaders);
        }
    } catch (error) {
        errorLog('Chat completions error', error);
        return new Response(JSON.stringify({ error: { message: 'AI service error', type: 'server_error', details: (error as Error).message } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function handleStructuredChatCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        const {
            model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
            messages,
            stream = false,
            max_tokens = 2048,
            temperature = 0.7,
            top_p = 1,
            frequency_penalty = 0,
            presence_penalty = 0,
            response_format,
            memory_keyword,
            ...otherParams
        } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { message: '`messages` parameter is required and must be an array', type: 'invalid_request_error' } }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (!response_format || !response_format.schema) {
            return new Response(JSON.stringify({ error: { message: '`response_format.schema` is required for structured responses', type: 'invalid_request_error' } }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const provider = detectProvider(model, env);
        const mappedModel = mapModelName(model, provider, env);
        const modelType = getModelType(mappedModel, provider);
        debugLog(env, `Routing structured request to provider`, { provider, model: mappedModel, type: modelType });

        const messagesWithMemory = memory_keyword ? await addMemoryContext(messages, memory_keyword, env) : messages;

        const handlerParams = {
            messages: messagesWithMemory,
            model: mappedModel,
            stream,
            max_tokens,
            temperature,
            top_p,
            frequency_penalty,
            presence_penalty,
            response_format,
            memory_keyword,
            ...otherParams,
            modelType,
            originalModel: model
        };

        switch (provider) {
            case 'openai':
                return handleOpenAIStructuredRequest(handlerParams, env, corsHeaders);
            case 'gemini':
                return handleGeminiStructuredRequest(handlerParams, env, corsHeaders);
            case 'cloudflare':
            default:
                return handleCloudflareStructuredRequest(handlerParams, env, corsHeaders);
        }
    } catch (error) {
        errorLog('Structured chat completions error', error);
        return new Response(JSON.stringify({ error: { message: 'AI service error', type: 'server_error', details: (error as Error).message } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function handleTextChatCompletions(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        const body = await request.json() as ChatCompletionRequestBody;
        const {
            model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
            messages,
            stream = false,
            max_tokens = 2048,
            temperature = 0.7,
            top_p = 1,
            frequency_penalty = 0,
            presence_penalty = 0,
            memory_keyword,
            ...otherParams
        } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: { message: '`messages` parameter is required and must be an array', type: 'invalid_request_error' } }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const provider = detectProvider(model, env);
        const mappedModel = mapModelName(model, provider, env);
        const modelType = getModelType(mappedModel, provider);
        debugLog(env, `Routing text request to provider`, { provider, model: mappedModel, type: modelType });

        const messagesWithMemory = memory_keyword ? await addMemoryContext(messages, memory_keyword, env) : messages;

        const handlerParams = {
            messages: messagesWithMemory,
            model: mappedModel,
            stream,
            max_tokens,
            temperature,
            top_p,
            frequency_penalty,
            presence_penalty,
            memory_keyword,
            ...otherParams,
            modelType,
            originalModel: model
        };

        switch (provider) {
            case 'openai':
                return handleOpenAITextRequest(handlerParams, env, corsHeaders);
            case 'gemini':
                return handleGeminiTextRequest(handlerParams, env, corsHeaders);
            case 'cloudflare':
            default:
                return handleCloudflareTextRequest(handlerParams, env, corsHeaders);
        }
    } catch (error) {
        errorLog('Text chat completions error', error);
        return new Response(JSON.stringify({ error: { message: 'AI service error', type: 'server_error', details: (error as Error).message } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
