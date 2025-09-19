/**
 * OpenAI-Compatible API Worker (TypeScript Version)
 *
 * This worker provides a unified, OpenAI-compatible API endpoint for various AI models,
 * including those from Cloudflare AI, OpenAI, and Google Gemini. It intelligently
 * routes requests to the appropriate backend provider based on the requested model.
 *
 * @version 2.1.0
 * @author Colby
 */

import { authenticateRequest } from './auth';
import { handleCompletions, handleModelsRequest, handleTestAPIs } from './endpoints';
import { handleChatCompletions, handleStructuredChatCompletions, handleTextChatCompletions } from './routing';
import { debugLog, errorLog, generateId } from './utils';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		debugLog(env, `Incoming request: ${request.method} ${path}`);

		const corsHeaders: Record<string, string> = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		if (request.method === 'OPTIONS') {
			debugLog(env, 'Handling CORS preflight request');
			return new Response(null, { headers: corsHeaders });
		}

		try {
            const publicRoutes: Record<string, string> = {
                '/': '/index.html',
                '/index.html': '/index.html',
                '/openapi.json': '/openapi.json',
                '/test-dropdowns.html': '/test-dropdowns.html',
                '/debug-test.html': '/debug-test.html',
                '/quick-test.html': '/quick-test.html',
                '/cloudflare_ai_models.json': '/cloudflare_ai_models.json',
            };

            if (publicRoutes[path]) {
                debugLog(env, `Serving static asset: ${publicRoutes[path]}`);
                try {
                    const asset = await env.ASSETS.fetch(new URL(request.url).origin + publicRoutes[path]);
                    const contentType = path.endsWith('.json') ? 'application/json' : 'text/html';
                    const response = new Response(asset.body, {
                        headers: { 'Content-Type': contentType, ...corsHeaders },
                    });
                    return response;
                } catch (error) {
                    errorLog(`Error serving static asset: ${path}`, error);
                    return new Response(`Not Found: ${path}`, { status: 404, headers: corsHeaders });
                }
            }


			if (path === '/health') {
				debugLog(env, 'Health check requested');
				return new Response(JSON.stringify({
					status: 'healthy',
					service: 'openai-api-worker',
					timestamp: new Date().toISOString(),
					version: '2.1.0',
					providers: {
						cloudflare: true,
						openai: !!env.OPENAI_API_KEY,
						gemini: !!env.GEMINI_API_KEY
					}
				}), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
			}

			const authResult = await authenticateRequest(request, env);
			if (!authResult.success) {
				errorLog(`Authentication failed: ${authResult.error}`);
				return new Response(JSON.stringify({ error: { message: authResult.error, type: 'invalid_request_error' } }), {
					status: 401,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}
			debugLog(env, 'Authentication successful');

			if (path === '/v1/chat/completions') {
				return handleChatCompletions(request, env, corsHeaders);
			}
			if (path === '/v1/chat/completions/structured') {
				return handleStructuredChatCompletions(request, env, corsHeaders);
			}
			if (path === '/v1/chat/completions/text') {
				return handleTextChatCompletions(request, env, corsHeaders);
			}
			if (path === '/v1/models') {
				return handleModelsRequest(request, env, corsHeaders);
			}
			if (path === '/v1/completions') {
				return handleCompletions(request, env, corsHeaders);
			}
			if (path === '/test/apis') {
				return handleTestAPIs(request, env, corsHeaders);
			}

			return new Response(JSON.stringify({ error: { message: 'Not Found', type: 'invalid_request_error' } }), {
				status: 404,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});

		} catch (error) {
			errorLog('Unhandled worker error', error);
			const errorResponse = {
				error: {
					message: 'Internal Server Error',
					type: 'server_error',
					details: error instanceof Error ? error.message : 'Unknown error',
					request_id: generateId()
				}
			};
			return new Response(JSON.stringify(errorResponse), {
				status: 500,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}
	},
};