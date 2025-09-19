/**
 * @file src/handlers/openai.ts
 * @description This file contains the request handler for OpenAI models.
 *              It uses the official OpenAI Node.js SDK to interact with the OpenAI API.
 *              The handler is responsible for creating a chat completion request,
 *              handling both streaming and non-streaming responses, and saving
 *              conversation context to KV memory. It also formats the final response
 *              to be compatible with the OpenAI API standard.
 */

import OpenAI from 'openai';
import { saveMemoryContext } from '../memory';
import { debugLog, errorLog, generateId } from '../utils';

/**
 * Handles a chat completion request directed to the OpenAI API.
 *
 * This function manages the interaction with OpenAI's API:
 * 1.  Checks for the presence of the `OPENAI_API_KEY`.
 * 2.  Initializes the OpenAI SDK.
 * 3.  Calls the `chat.completions.create` method with the provided parameters.
 * 4.  If streaming is enabled, it returns the raw stream from the SDK.
 * 5.  If streaming is disabled, it awaits the full response.
 * 6.  Saves the conversation context to KV memory if a `memory_keyword` is present.
 * 7.  Returns the completion response, either as a stream or a complete JSON object.
 * 8.  Includes robust error handling to manage API failures gracefully.
 *
 * @param {any} params - An object containing all necessary parameters for the OpenAI API call,
 *                       such as `model`, `messages`, `stream`, etc.
 * @param {Env} env - The worker's environment, containing the `OPENAI_API_KEY`.
 * @param {Record<string, string>} corsHeaders - The CORS headers to be included in the response.
 * @returns {Promise<Response>} A promise that resolves to the final `Response` object.
 */
export async function handleOpenAIRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        if (!env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }
        
        debugLog(env, 'Making OpenAI API request', { model: params.model });
        
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        
        // Filter out internal parameters that shouldn't be sent to the API
        const { modelType, originalModel, memory, memory_keyword, ...apiParams } = params;
        
        const completion = await openai.chat.completions.create(apiParams);

        if (params.stream) {
            // For streaming responses, return the SDK's stream directly.
            return new Response(completion as any, {
                headers: { 'Content-Type': 'text/event-stream', ...corsHeaders }
            });
        } else {
            // For non-streaming responses, extract the content and save to memory.
            const responseText = (completion as any).choices[0]?.message?.content || '';
            await saveMemoryContext(params.messages, responseText, params.memory_keyword, env);
            
            return new Response(JSON.stringify(completion), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    } catch (error) {
        errorLog('OpenAI request failed', error);
        const errorResponse = {
            error: {
                message: 'OpenAI API error',
                type: 'api_error',
                details: error instanceof Error ? error.message : 'Unknown OpenAI error',
                request_id: generateId()
            }
        };
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

/**
 * A wrapper function for handling structured chat completion requests with OpenAI.
 * It delegates directly to the main `handleOpenAIRequest` function, as the core
 * SDK call is the same. The structured response parameters are assumed to be in `params`.
 */
export async function handleOpenAIStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleOpenAIRequest(params, env, corsHeaders);
}

/**
 * A wrapper function for handling text-only chat completion requests with OpenAI.
 * It delegates directly to the main `handleOpenAIRequest` function.
 */
export async function handleOpenAITextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleOpenAIRequest(params, env, corsHeaders);
}