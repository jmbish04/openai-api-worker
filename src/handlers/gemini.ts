

import { GoogleGenAI } from '@google/genai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { saveMemoryContext } from '../memory';
import { ChatMessage } from '../types';
import { debugLog, errorLog, generateId } from '../utils';
import { convertOpenAISchemaToGemini } from '../models';

async function handleGeminiRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        if (!env.GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }
        
        debugLog(env, 'Making Gemini API request', { model: params.model });

        const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        
        const conversationMessages = params.messages.filter((msg: ChatMessage) => msg.role !== 'system');
        
        const history = conversationMessages.map((msg: ChatMessage) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        let config: any = {};
        if (params.response_format) {
            if (params.response_format.type === 'json_object') {
                config.responseMimeType = 'application/json';
            } else if (params.response_format.type === 'json_schema' && params.response_format.schema) {
                config.responseMimeType = 'application/json';
                config.responseSchema = convertOpenAISchemaToGemini(params.response_format.schema);
            }
        }

        if (params.stream) {
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            const streamResponse = async () => {
                try {
                    const streamResult = await genAI.getGenerativeModel({ model: params.model }).generateContentStream({
                        contents: history,
                        generationConfig: config
                    });

                    for await (const chunk of streamResult.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            const delta = {
                                id: `chatcmpl-${generateId()}`,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: params.model,
                                choices: [{
                                    index: 0,
                                    delta: { content: chunkText },
                                    finish_reason: null
                                }]
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
                        choices: [{
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                        }]
                    };
                    
                    await writer.write(encoder.encode(`data: ${JSON.stringify(finalChunk)}

`));
                    await writer.write(encoder.encode('data: [DONE]

'));
                } catch (error) {
                    errorLog('Gemini streaming error', error);
                    const errorChunk = `data: ${JSON.stringify({ error: { message: (error as Error).message, type: 'server_error' } })}

`;
                    await writer.write(encoder.encode(errorChunk));
                } finally {
                    writer.close();
                }
            };

            streamResponse();
            return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream', ...corsHeaders }
            });
        } else {
            const result = await genAI.getGenerativeModel({ model: params.model }).generateContent({
                contents: history,
                generationConfig: config
            });
            const text = result.response.text();

            await saveMemoryContext(params.messages, text, params.memory_keyword, env);

            const openaiResponse: ChatCompletion = {
                id: `chatcmpl-${generateId()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: params.model,
                choices: [{ 
                    index: 0, 
                    message: { role: 'assistant', content: text }, 
                    finish_reason: 'stop',
                }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
            return new Response(JSON.stringify(openaiResponse), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
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
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function handleGeminiStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleGeminiRequest(params, env, corsHeaders);
}

export async function handleGeminiTextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleGeminiRequest(params, env, corsHeaders);
}
