/**
 * @file src/handlers/codex.ts
 * @description Handler for Codex CLI requests that routes them directly to Workers AI
 *              without using the AI Gateway. The handler parses the native Codex
 *              payload, normalizes it into a Workers AI compatible format, and streams
 *              the response back to the client.
 */

import type { CodexRequestBody, OpenAIMessage, Env } from '../types';

export const CODEX_ROUTE_PATTERN = /^\/codex\/workers-ai\/([^/]+)$/;

/**
 * Transforms a Codex-style request payload into the simplified messages format expected
 * by Workers AI. System prompts are concatenated together, user prompts are combined into
 * a single entry, and assistant messages are preserved in their original order.
 */
export function transformCodexToWorkerMessages(codexRequest: CodexRequestBody): OpenAIMessage[] {
        const messages: OpenAIMessage[] = [];
        let systemBuffer = '';
        const userBuffer: string[] = [];

        const flushSystem = () => {
                if (systemBuffer.trim().length > 0) {
                        messages.push({ role: 'system', content: systemBuffer.trim() });
                        systemBuffer = '';
                }
        };

        const flushUser = () => {
                if (userBuffer.length > 0) {
                        messages.push({ role: 'user', content: userBuffer.join('\n\n') });
                        userBuffer.length = 0;
                }
        };

        for (const message of codexRequest.messages) {
                switch (message.role) {
                        case 'system':
                                systemBuffer = systemBuffer ? `${systemBuffer}\n\n${message.content}` : message.content;
                                break;
                        case 'user':
                                userBuffer.push(message.content);
                                break;
                        case 'assistant':
                                flushSystem();
                                flushUser();
                                messages.push({ role: 'assistant', content: message.content });
                                break;
                        default:
                                break;
                }
        }

        flushSystem();
        flushUser();

        return messages;
}

function applyCorsHeaders(headers: Headers, corsHeaders?: Record<string, string>): void {
        if (!corsHeaders) {
                return;
        }

        for (const [key, value] of Object.entries(corsHeaders)) {
                headers.set(key, value);
        }
}

function createErrorResponse(
        message: string,
        status: number,
        corsHeaders?: Record<string, string>,
        extraFields?: Record<string, unknown>,
): Response {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        applyCorsHeaders(headers, corsHeaders);
        const body = { error: message, ...(extraFields ?? {}) };
        return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Handles incoming Codex CLI requests and proxies them directly to Workers AI by using
 * the bound `env.AI` service. The model identifier is derived from the request URL and
 * the payload is transformed to the format required by `env.AI.run`.
 */
export async function handleCodexRequest(
        request: Request,
        env: Env,
        modelFromRoute?: string,
        corsHeaders?: Record<string, string>,
): Promise<Response> {
        if (request.method !== 'POST') {
                return createErrorResponse('Method Not Allowed', 405, corsHeaders);
        }

        try {
                const codexRequest = await request.json<CodexRequestBody>();
                const modelName = modelFromRoute || codexRequest.model;

                if (!modelName) {
                        return createErrorResponse('Model not specified in URL path or request body.', 400, corsHeaders);
                }

                if (!env.AI) {
                        return createErrorResponse('AI binding is not configured.', 500, corsHeaders);
                }

                let modelIdentifier: string;
                if (modelName.startsWith('@')) {
                        modelIdentifier = modelName;
                } else {
                        if (!env.CLOUDFLARE_ACCOUNT_ID) {
                                return createErrorResponse(
                                        'CLOUDFLARE_ACCOUNT_ID is required to resolve short model names.',
                                        500,
                                        corsHeaders,
                                );
                        }
                        modelIdentifier = `@cf/${env.CLOUDFLARE_ACCOUNT_ID}/${modelName}`;
                }

                const messages = transformCodexToWorkerMessages(codexRequest);
                const payload: Record<string, unknown> = {
                        messages,
                        stream: codexRequest.stream ?? false,
                };

                if (Array.isArray(codexRequest.tools) && codexRequest.tools.length > 0) {
                        payload.tools = codexRequest.tools;
                }

                const aiResponse = await env.AI.run(modelIdentifier, payload);
                const isStream = Boolean(codexRequest.stream);
                const headers = new Headers({
                        'Content-Type': isStream ? 'application/x-ndjson' : 'application/json',
                });
                applyCorsHeaders(headers, corsHeaders);

                if (isStream && aiResponse instanceof ReadableStream) {
                        return new Response(aiResponse, { headers });
                }

                const body = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
                return new Response(body, { headers });
        } catch (error) {
                console.error('Error handling Codex request:', error);
                const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
                return createErrorResponse(
                        'Invalid request body or processing error.',
                        400,
                        corsHeaders,
                        { details: message },
                );
        }
}
