/**
 * @file src/auth.ts
 * @description This file contains the authentication logic for the API worker.
 *              It is responsible for validating the `Authorization` header of incoming
 *              requests to ensure that only authorized clients can access the API endpoints.
 *              Centralizing this logic makes the security model easier to manage and update.
 */

import { debugLog } from './utils';

/**
 * Authenticates an incoming request based on the `Authorization` header.
 * It checks for the presence of a Bearer token and validates it against the
 * `WORKER_API_KEY` environment variable. In debug mode, this validation can be bypassed.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @param {Env} env - The worker's environment object, containing secrets and configuration.
 * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves to an object
 *          indicating the authentication result.
 *          - `success`: `true` if authentication is successful, `false` otherwise.
 *          - `error`: A descriptive error message if authentication fails.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<{ success: boolean; error?: string }> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return { success: false, error: 'Missing Authorization header' };
	}
	if (!authHeader.startsWith('Bearer ')) {
		return { success: false, error: 'Invalid Authorization header format. Use: Bearer <token>' };
	}
	const token = authHeader.replace('Bearer ', '');

	// In debug mode or if the API key is not set, bypass validation for development convenience.
	if (env.DEBUG_LOGGING === 'true' || !env.WORKER_API_KEY) {
		debugLog(env, 'Development mode: bypassing API key validation');
		return { success: true };
	}

	// Compare the provided token with the one stored in environment variables.
	if (token !== env.WORKER_API_KEY) {
		debugLog(env, 'API key validation failed');
		return { success: false, error: 'Invalid API key' };
	}

	return { success: true };
}