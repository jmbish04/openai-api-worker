
import { debugLog } from './utils';

export async function authenticateRequest(request: Request, env: Env): Promise<{ success: boolean; error?: string }> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return { success: false, error: 'Missing Authorization header' };
	}
	if (!authHeader.startsWith('Bearer ')) {
		return { success: false, error: 'Invalid Authorization header format. Use: Bearer <token>' };
	}
	const token = authHeader.replace('Bearer ', '');

	if (env.DEBUG_LOGGING === 'true' || !env.WORKER_API_KEY) {
		debugLog(env, 'Development mode: bypassing API key validation');
		return { success: true };
	}

	if (token !== env.WORKER_API_KEY) {
		debugLog(env, 'API key validation failed');
		return { success: false, error: 'Invalid API key' };
	}

	return { success: true };
}
