/**
 * @file src/handlers/cloudflare.ts
 * @description This file contains the request handler for Cloudflare AI models.
 *              It prepares the request payload according to the specific model's requirements
 *              (e.g., using a prompt string or a message array), invokes the AI model
 *              using the `env.AI.run` binding, and formats the response to be
 *              OpenAI-compatible. It supports both streaming and non-streaming responses.
 */

import { saveMemoryContext } from '../memory';
import { convertMessages } from '../models';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { debugLog, errorLog, generateId } from '../utils';

/**
 * Handles a chat completion request directed to a Cloudflare AI model.
 *
 * This function orchestrates the entire process for Cloudflare AI requests:
 * 1.  Logs the request details for debugging.
 * 2.  Converts the incoming OpenAI-formatted messages to the format required by the specific Cloudflare model.
 * 3.  Constructs the payload for the `env.AI.run` method, including support for streaming and structured JSON output.
 * 4.  Calls the AI model via the service binding.
 * 5.  Handles the response, either by streaming it back to the client or by formatting the complete response
 *     into an OpenAI-compatible `ChatCompletion` object.
 * 6.  Saves the conversation to KV memory if a `memory_keyword` is provided.
 * 7.  Returns a standard `Response` object with appropriate headers.
 *
 * @param {any} params - An object containing all necessary parameters for the request,
 *                       including the model, messages, stream flag, and other settings.
 * @param {Env} env - The worker's environment, providing access to the AI binding.
 * @param {Record<string, string>} corsHeaders - The CORS headers to be included in the response.
 * @returns {Promise<Response>} A promise that resolves to the final `Response` object to be sent to the client.
 */
async function handleCloudflareRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        debugLog(env, `Making Cloudflare AI request`, { model: params.model, type: params.modelType });
        const convertedMessages = convertMessages(params.messages, 'cloudflare', params.modelType);
    
        let aiRequestPayload: any;
        if (params.modelType === 'llama4') {
            // Try messages format first, fall back to input format if it fails
            if (Array.isArray(convertedMessages)) {
                aiRequestPayload = { 
                    messages: convertedMessages, 
                    stream: params.stream 
                };
            } else {
                // Fall back to input format for models that don't support messages
                aiRequestPayload = { 
                    input: (convertedMessages as { input: string }).input, 
                    stream: params.stream 
                };
            }
            
            // Add support for structured JSON output if requested and supported by the model.
            if (params.response_format) {
                if (params.response_format.type === 'json_object') {
                    aiRequestPayload.response_format = { type: 'json_object' };
                } else if (params.response_format.type === 'json_schema' && params.response_format.schema) {
                    aiRequestPayload.response_format = { 
                        type: 'json_schema',
                        json_schema: params.response_format.schema
                    };
                }
            }
        } else {
            // For older models that expect a single prompt string.
            aiRequestPayload = { 
                input: (convertedMessages as { input: string }).input, 
                stream: params.stream 
            };
        }
    
        const responseStream: ReadableStream = await env.AI.run(params.model, aiRequestPayload);

        if (params.stream) {
            // Pipe the streaming response directly from the AI model to the client.
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            const streamResponse = async () => {
                const reader = responseStream.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        await writer.write(value); // Pass through the Server-Sent Event chunks.
                    }
                    const finalChunk = `data: [DONE]\n\n`;
                    await writer.write(encoder.encode(finalChunk));
                } catch (error) {
                    errorLog('Cloudflare streaming error', error);
                    const errorChunk = `data: ${JSON.stringify({ error: { message: (error as Error).message, type: 'server_error' } })}` + '\n\n';
                    await writer.write(encoder.encode(errorChunk));
                } finally {
                    writer.close();
                    reader.releaseLock();
                }
            };

            streamResponse();
            return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream', ...corsHeaders }
            });
        } else {
            // Handle non-streaming response.
            const response: any = await responseStream;
            const content = response.response || response.result || response.text || (typeof response === 'string' ? response : JSON.stringify(response));

            await saveMemoryContext(params.messages, content, params.memory_keyword, env);

            const openaiResponse: ChatCompletion = {
                id: `chatcmpl-${generateId()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: params.originalModel,
                choices: [{ 
                    index: 0, 
                    message: { role: 'assistant', content, refusal: null }, 
                    finish_reason: 'stop',
                    logprobs: null
                }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } // Usage data not provided by Cloudflare AI.
            };

            return new Response(JSON.stringify(openaiResponse), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    } catch (error) {
        errorLog('Cloudflare AI request failed', error);
        const errorResponse = {
            error: {
                message: 'Cloudflare AI error',
                type: 'api_error',
                details: error instanceof Error ? error.message : 'Unknown Cloudflare AI error',
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
 * A wrapper function for handling structured chat completion requests with Cloudflare AI.
 * It currently delegates directly to the main `handleCloudflareRequest` function.
 */
export async function handleCloudflareStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleCloudflareRequest(params, env, corsHeaders);
}

/**
 * A wrapper function for handling text-only chat completion requests with Cloudflare AI.
 * It currently delegates directly to the main `handleCloudflareRequest` function.
 */
export async function handleCloudflareTextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleCloudflareRequest(params, env, corsHeaders);
}