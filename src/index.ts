/**
 * @file src/index.ts
 * @description This is the main entry point for the Cloudflare Worker.
 * It sets up the main `fetch` event listener and routes incoming
 * requests to the appropriate handlers based on the URL path.
 * This file imports functionality from various modules to keep the
 * top-level logic clean and organized. It handles CORS preflight
 * requests, static asset serving, health checks, authentication,
 * and API endpoint routing.
 *
 * @version 2.1.0
 * @author Colby
 */

import { authenticateRequest } from './auth';
import { handleCompletions, handleCompletionsWithMemory, handleModelsRequest, handleTestAPIs } from './endpoints';
import { runEndpointHealthChecks } from './health';
import { handleChatCompletions, handleStructuredChatCompletions, handleTextChatCompletions, handleCodexRoute } from './routing';
import { debugLog, errorLog, generateId } from './utils';
import { getRequestQueue } from './request-queue';

const PUBLIC_ROUTES: Record<string, string> = {
    '/': '/index.html',
    '/index.html': '/index.html',
    '/openapi.json': '/openapi.json',
    '/health.html': '/health.html',
    '/test-dropdowns.html': '/test-dropdowns.html',
    '/debug-test.html': '/debug-test.html',
    '/quick-test.html': '/quick-test.html',
    '/cloudflare_ai_models.json': '/cloudflare_ai_models.json',
};

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Shared handler for all incoming requests.
 * Exported separately to make it easy to reuse in unit tests and health checks.
 */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    debugLog(env, `Incoming request: ${request.method} ${path}`);

    if (request.method === 'OPTIONS') {
        debugLog(env, 'Handling CORS preflight request');
        return new Response(null, { headers: CORS_HEADERS });
    }

    try {
        if (PUBLIC_ROUTES[path]) {
            debugLog(env, `Serving static asset: ${PUBLIC_ROUTES[path]}`);
            try {
                const assetResponse = await env.ASSETS.fetch(new URL(request.url).origin + PUBLIC_ROUTES[path]);
                const headers = new Headers(assetResponse.headers);

                // Ensure consistent CORS headers for all static responses.
                for (const [key, value] of Object.entries(CORS_HEADERS)) {
                    headers.set(key, value);
                }

                // Override the content type for HTML/JSON assets if not already set on successful responses.
                if (assetResponse.ok) {
                    if (path.endsWith('.json')) {
                        headers.set('Content-Type', 'application/json');
                    } else if (!headers.has('Content-Type')) {
                        headers.set('Content-Type', 'text/html');
                    }
                }

                return new Response(assetResponse.body, {
                    status: assetResponse.status,
                    statusText: assetResponse.statusText,
                    headers,
                });
            } catch (error) {
                errorLog(`Error serving static asset: ${path}`, error);
                return new Response(`Not Found: ${path}`, { status: 404, headers: CORS_HEADERS });
            }
        }

        if (path === '/health') {
            debugLog(env, 'Health check requested');
            const report = await runEndpointHealthChecks(
                (req: Request) => handleRequest(req, env),
                env,
                {
                    baseUrl: url.origin,
                    includeHealthEndpointTest: false,
                },
            );

            return new Response(JSON.stringify({
                status: report.status,
                service: 'openai-api-worker',
                version: '2.1.0',
                timestamp: new Date().toISOString(),
                durationMs: report.durationMs,
                summary: report.summary,
                tests: report.tests,
            }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
        }

        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) {
            errorLog(`Authentication failed: ${authResult.error}`);
            return new Response(JSON.stringify({ error: { message: authResult.error, type: 'invalid_request_error' } }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
        debugLog(env, 'Authentication successful');

        const requestQueue = getRequestQueue(env);

        const codexResponse = await handleCodexRoute(request, env, CORS_HEADERS);
        if (codexResponse) {
            return codexResponse;
        }

        // Route API requests to their respective handlers.
        switch (path) {
            case '/v1/chat/completions':
                return requestQueue.enqueue(() => handleChatCompletions(request, env, CORS_HEADERS));
            case '/v1/chat/completions/structured':
                return requestQueue.enqueue(() => handleStructuredChatCompletions(request, env, CORS_HEADERS));
            case '/v1/chat/completions/text':
                return requestQueue.enqueue(() => handleTextChatCompletions(request, env, CORS_HEADERS));
            case '/v1/models':
                return requestQueue.enqueue(() => handleModelsRequest(request, env, CORS_HEADERS));
            case '/v1/completions':
                return requestQueue.enqueue(() => handleCompletions(request, env, CORS_HEADERS));
            case '/v1/completions/withmemory':
                return requestQueue.enqueue(() => handleCompletionsWithMemory(request, env, CORS_HEADERS));
            case '/test/apis':
                return requestQueue.enqueue(() => handleTestAPIs(request, env, CORS_HEADERS));
            default:
                return new Response(JSON.stringify({ error: { message: 'Not Found', type: 'invalid_request_error' } }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
                });
        }
    } catch (error) {
        errorLog('Unhandled error in handleRequest', error);
        return new Response(JSON.stringify({ error: { message: 'Internal Server Error', type: 'internal_error' } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }
}

export default { fetch: handleRequest };
