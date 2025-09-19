
/**
 * Logs a debug message if debug logging is enabled.
 * @param env - The worker's environment variables.
 * @param message - The message to log.
 * @param data - Optional data to log as an object.
 */
export function debugLog(env: Env, message: string, data: Record<string, any> | null = null): void {
	if (env.DEBUG_LOGGING === 'true') {
		const timestamp = new Date().toISOString();
		if (data) {
			console.log(`[${timestamp}] ${message}:`, JSON.stringify(data, null, 2));
		} else {
			console.log(`[${timestamp}] ${message}`);
		}
	}
}

/**
 * Logs an error message to the console.
 * @param message - The error message.
 * @param error - Optional error object or details.
 */
export function errorLog(message: string, error: any | null = null): void {
	const timestamp = new Date().toISOString();
	if (error) {
		console.error(`[${timestamp}] ERROR: ${message}:`, error instanceof Error ? error.stack : JSON.stringify(error));
	} else {
		console.error(`[${timestamp}] ERROR: ${message}`);
	}
}

export function generateId(length = 12): string {
    return Math.random().toString(36).substring(2, 2 + length);
}
