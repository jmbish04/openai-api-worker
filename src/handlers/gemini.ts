/**
 * @file src/handlers/gemini.ts
 * @description This file contains the request handler for Google Gemini models.
 *              It uses the `@google/genai` SDK to interact with the Gemini API.
 *              The handler is responsible for converting OpenAI-formatted requests
 *              to the Gemini format, managing both streaming and non-streaming responses,
 *              and transforming Gemini's output back into an OpenAI-compatible format.
 */

import { GoogleGenAI } from "@google/genai";
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { saveMemoryContext } from '../memory';
import type { ChatMessage } from '../types';
import { debugLog, errorLog, generateId } from '../utils';
import { convertOpenAISchemaToGemini } from '../models';

/**
 * Handles a chat completion request directed to the Google Gemini API.
 *
 * This function adapts the OpenAI-style request to the Gemini API's requirements:
 * 1.  Checks for the `GEMINI_API_KEY`.
 * 2.  Initializes the GoogleGenAI SDK.
 * 3.  Converts the `messages` array to Gemini's `history` format.
 * 4.  Handles `response_format` for structured JSON output by converting the schema if necessary.
 * 5.  For streaming requests, it initiates a content stream and wraps each chunk in an
 *     OpenAI-compatible Server-Sent Event format.
 * 6.  For non-streaming requests, it gets the complete response and formats it as an
 *     OpenAI `ChatCompletion` object.
 * 7.  Saves conversation context to KV memory.
 * 8.  Returns a `Response` object with the appropriate content type and headers.
 *
 * @param {any} params - An object containing request parameters like `model`, `messages`, etc.
 * @param {Env} env - The worker's environment, containing the `GEMINI_API_KEY`.
 * @param {Record<string, string>} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} A promise resolving to the final `Response` object.
 */
export async function handleGeminiRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        if (!env.GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }
        
        debugLog(env, 'Making Gemini API request', { model: params.model });

        const genAI = new GoogleGenAI({apiKey: env.GEMINI_API_KEY});
        
        // Convert messages to Gemini's format, filtering out system messages.
        const conversationMessages = params.messages.filter((msg: ChatMessage) => msg.role !== 'system');
        const history = conversationMessages.map((msg: ChatMessage) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Prepare generation config for structured responses.
        let generationConfig: any = {};
        if (params.response_format) {
            if (params.response_format.type === 'json_object') {
                generationConfig.responseMimeType = 'application/json';
            } else if (params.response_format.type === 'json_schema' && params.response_format.schema) {
                generationConfig.responseMimeType = 'application/json';
                generationConfig.responseSchema = convertOpenAISchemaToGemini(params.response_format.schema);
            }
        }

        if (params.stream) {
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            const streamResponse = async () => {
                try {
                    const streamResult = await genAI.models.generateContentStream({
                        model: params.model,
                        contents: history,
                        config: generationConfig
                    });


                    for await (const chunk of streamResult) {
                        const chunkText = chunk.text;
                        if (chunkText) {
                            const delta = {
                                id: `chatcmpl-${generateId()}`,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: params.model,
                                choices: [{ index: 0, delta: { content: chunkText }, finish_reason: null }]
                            };
                            await writer.write(encoder.encode(`data: ${JSON.stringify(delta)}

`));
                        }
                    }

                    const finalChunk = {
                        id: `chatcmpl-${generateId()}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: params.model,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                    };
                    await writer.write(encoder.encode(`data: ${JSON.stringify(finalChunk)}`));
                    await writer.write(encoder.encode('data: [DONE]'));
                } catch (error) {
                    errorLog('Gemini streaming error', error);
                    const errorChunk = `data: ${JSON.stringify({ error: { message: (error as Error).message, type: 'server_error' } })}\n\n`;
                    await writer.write(encoder.encode(errorChunk));
                } finally {
                    writer.close();
                }
            };

            streamResponse();
            return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', ...corsHeaders } });
        } else {
            const result = await genAI.models.generateContent({
                model: params.model,
                contents: history,
                config: generationConfig
            });

            const text = result.text || '';

            await saveMemoryContext(params.messages, text, params.memory_keyword, env);

            const openaiResponse: ChatCompletion = {
                id: `chatcmpl-${generateId()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: params.model,
                choices: [{ index: 0, message: { role: 'assistant', content: text || null, refusal: null }, finish_reason: 'stop', logprobs: null }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } // Usage data not provided by Gemini
            };
            return new Response(JSON.stringify(openaiResponse), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
    } catch (error) {
        errorLog('Gemini request failed', error);
        const errorResponse = {
            error: {
                message: 'Gemini API error',
                type: 'api_error',
                details: error instanceof Error ? error.message : 'Unknown Gemini error',
                request_id: generateId()
            }
        };
        return new Response(JSON.stringify(errorResponse), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
}

/**
 * A wrapper for handling structured chat requests with Gemini. Delegates to the main handler.
 */
export async function handleGeminiStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleGeminiRequest(params, env, corsHeaders);
}

/**
 * A wrapper for handling text-only chat requests with Gemini. Delegates to the main handler.
 */
export async function handleGeminiTextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleGeminiRequest(params, env, corsHeaders);
}