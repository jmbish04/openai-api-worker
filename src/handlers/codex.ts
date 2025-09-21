/**
 * @file src/handlers/codex.ts
 * @description Handler for Codex CLI requests that routes them directly to Workers AI
 *              without using the AI Gateway. The handler parses the native Codex
 *              payload, normalizes it into a Workers AI compatible format, and streams
 *              the response back to the client.
 */

import type { CodexRequestBody, OpenAIMessage, Env } from '../types';

const CODEX_ROUTE_PATTERN = /^\/codex\/workers-ai\/([^/]+)$/;

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

function deriveModelName(request: Request, providedModel?: string): string | null {
        if (providedModel) {
                return providedModel;
        }

        const match = new URL(request.url).pathname.match(CODEX_ROUTE_PATTERN);
        if (match?.[1]) {
                return match[1];
        }

        return null;
}

function applyCorsHeaders(headers: Headers, corsHeaders?: Record<string, string>): void {
        if (!corsHeaders) {
                return;
        }

        for (const [key, value] of Object.entries(corsHeaders)) {
                headers.set(key, value);
        }
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
        corsHeaders?: Record<string, string>
): Promise<Response> {
        if (request.method !== 'POST') {
                const headers = new Headers({ 'Content-Type': 'application/json' });
                applyCorsHeaders(headers, corsHeaders);
                return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
        }

        try {
                const codexRequest = await request.json<CodexRequestBody>();
                const modelName = deriveModelName(request, modelFromRoute) || codexRequest.model;

                if (!modelName) {
                        const headers = new Headers({ 'Content-Type': 'application/json' });
                        applyCorsHeaders(headers, corsHeaders);
                        return new Response(JSON.stringify({ error: 'Model not specified in URL path or request body.' }), {
                                status: 400,
                                headers,
                        });
                }

                if (!env.CLOUDFLARE_ACCOUNT_ID) {
                        const headers = new Headers({ 'Content-Type': 'application/json' });
                        applyCorsHeaders(headers, corsHeaders);
                        return new Response(JSON.stringify({ error: 'CLOUDFLARE_ACCOUNT_ID is not configured.' }), {
                                status: 500,
                                headers,
                        });
                }

                if (!env.AI) {
                        const headers = new Headers({ 'Content-Type': 'application/json' });
                        applyCorsHeaders(headers, corsHeaders);
                        return new Response(JSON.stringify({ error: 'AI binding is not configured.' }), {
                                status: 500,
                                headers,
                        });
                }

                const messages = transformCodexToWorkerMessages(codexRequest);
                const payload: Record<string, unknown> = {
                        messages,
                        stream: codexRequest.stream ?? false,
                };

                if (Array.isArray(codexRequest.tools) && codexRequest.tools.length > 0) {
                        payload.tools = codexRequest.tools;
                }

                const modelIdentifier = modelName.startsWith('@cf/')
                        ? modelName
                        : `@cf/${env.CLOUDFLARE_ACCOUNT_ID}/${modelName}`;

                const aiResponse = await env.AI.run(modelIdentifier, payload);

                if (codexRequest.stream) {
                        const headers = new Headers({ 'Content-Type': 'application/x-ndjson' });
                        applyCorsHeaders(headers, corsHeaders);

                        if (aiResponse instanceof ReadableStream) {
                                return new Response(aiResponse, { headers });
                        }

                        const body = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
                        return new Response(body, { headers });
                }

                const headers = new Headers({ 'Content-Type': 'application/json' });
                applyCorsHeaders(headers, corsHeaders);
                const body = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
                return new Response(body, { headers });
        } catch (error) {
                console.error('Error handling Codex request:', error);
                const headers = new Headers({ 'Content-Type': 'application/json' });
                applyCorsHeaders(headers, corsHeaders);
                const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
                return new Response(
                        JSON.stringify({ error: 'Invalid request body or processing error.', details: message }),
                        { status: 400, headers },
                );
        }
}

export function extractCodexModelFromPath(pathname: string): string | null {
        const match = pathname.match(CODEX_ROUTE_PATTERN);
        return match?.[1] ?? null;
}

