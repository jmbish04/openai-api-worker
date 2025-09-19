/**
 * @file src/index.ts
 * @description This is the main entry point for the Cloudflare Worker.
 *              It sets up the main `fetch` event listener and routes incoming
 *              requests to the appropriate handlers based on the URL path.
 *              This file imports functionality from various modules to keep the
 *              top-level logic clean and organized. It handles CORS preflight
 *              requests, static asset serving, health checks, authentication,
 *              and API endpoint routing.
 *
 * @version 2.1.0
 * @author Colby
 */

import { authenticateRequest } from './auth';
import { handleCompletions, handleCompletionsWithMemory, handleModelsRequest, handleTestAPIs } from './endpoints';
import { handleChatCompletions, handleStructuredChatCompletions, handleTextChatCompletions } from './routing';
import { debugLog, errorLog, generateId } from './utils';

export default {
	/**
	 * The main fetch handler for the Cloudflare Worker.
	 * This function is executed for every incoming HTTP request.
	 *
	 * @param {Request} request - The incoming request object.
	 * @param {Env} env - The environment object containing bindings and variables.
	 * @returns {Promise<Response>} A promise that resolves to the response to be sent to the client.
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		debugLog(env, `Incoming request: ${request.method} ${path}`);

		// Define CORS headers for preflight (OPTIONS) and actual requests.
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
            // A map of public routes that do not require authentication.
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
                    // Use the ASSETS binding to fetch static files.
                    const asset = await env.ASSETS.fetch(new URL(request.url).origin + publicRoutes[path]);
                    const contentType = path.endsWith('.json') ? 'application/json' : 'text/html';
                    return new Response(asset.body, {
                        headers: { 'Content-Type': contentType, ...corsHeaders },
                    });
                } catch (error) {
                    errorLog(`Error serving static asset: ${path}`, error);
                    return new Response(`Not Found: ${path}`, { status: 404, headers: corsHeaders });
                }
            }

			// Health check endpoint for monitoring.
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

			// Authenticate all other API requests.
			const authResult = await authenticateRequest(request, env);
			if (!authResult.success) {
				errorLog(`Authentication failed: ${authResult.error}`);
				return new Response(JSON.stringify({ error: { message: authResult.error, type: 'invalid_request_error' } }), {
					status: 401,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}
			debugLog(env, 'Authentication successful');

			// Route API requests to their respective handlers.
			switch (path) {
				case '/v1/chat/completions':
					return handleChatCompletions(request, env, corsHeaders);
				case '/v1/chat/completions/structured':
					return handleStructuredChatCompletions(request, env, corsHeaders);
				case '/v1/chat/completions/text':
					return handleTextChatCompletions(request, env, corsHeaders);
				case '/v1/models':
					return handleModelsRequest(request, env, corsHeaders);
				case '/v1/completions':
					return handleCompletions(request, env, corsHeaders);
				case '/v1/completions/withmemory':
					return handleCompletionsWithMemory(request, env, corsHeaders);
				case '/test/apis':
					return handleTestAPIs(request, env, corsHeaders);
				default:
					return new Response(JSON.stringify({ error: { message: 'Not Found', type: 'invalid_request_error' } }), {
						status: 404,
						headers: { 'Content-Type': 'application/json', ...corsHeaders },
					});
			}

		} catch (error) {
			// Global error handler for any unhandled exceptions.
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
