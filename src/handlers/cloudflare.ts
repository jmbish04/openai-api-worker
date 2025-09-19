

import { saveMemoryContext } from '../memory';
import { convertMessages } from '../models';
import { ChatCompletion } from 'openai/resources/chat/completions';
import { debugLog, errorLog, generateId } from '../utils';

async function handleCloudflareRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        debugLog(env, `Making Cloudflare AI request`, { model: params.model, type: params.modelType });
        const convertedMessages = convertMessages(params.messages, 'cloudflare', params.modelType);
    
        let aiRequestPayload: any;
        if (params.modelType === 'llama4') {
            aiRequestPayload = { 
                messages: Array.isArray(convertedMessages) ? convertedMessages : params.messages, 
                stream: params.stream 
            };
            
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
            aiRequestPayload = { 
                prompt: (convertedMessages as { input: string }).input, 
                stream: params.stream 
            };
        }
    
        const responseStream: ReadableStream = await env.AI.run(params.model, aiRequestPayload);

        if (params.stream) {
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            const streamResponse = async () => {
                const reader = responseStream.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        await writer.write(value);
                    }
                    const finalChunk = `data: [DONE]\n\n`;
                    await writer.write(encoder.encode(finalChunk));
                } catch (error) {
                    errorLog('Cloudflare streaming error', error);
                    const errorChunk = `data: ${JSON.stringify({ error: { message: (error as Error).message, type: 'server_error' } })}\n\n`;
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
            const response: any = await responseStream;
            let content = response.response || response.result || response.text || (typeof response === 'string' ? response : JSON.stringify(response));

            await saveMemoryContext(params.messages, content, params.memory_keyword, env);

            const openaiResponse: ChatCompletion = {
                id: `chatcmpl-${generateId()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: params.originalModel,
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
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

export async function handleCloudflareStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleCloudflareRequest(params, env, corsHeaders);
}

export async function handleCloudflareTextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleCloudflareRequest(params, env, corsHeaders);
}

