/**
 * @file src/utils.ts
 * @description This file contains general-purpose utility functions used across the worker.
 *              These functions handle tasks like conditional logging and unique ID generation,
 *              which are essential for debugging, monitoring, and maintaining the service.
 *              Keeping them separate improves code organization and reusability.
 */

/**
 * Conditionally logs a message to the console if the `DEBUG_LOGGING` environment variable is set to 'true'.
 * This is useful for enabling detailed logging in a development or staging environment without
 * cluttering the logs in production.
 *
 * @param {Env} env - The worker's environment object, containing environment variables.
 * @param {string} message - The primary message to be logged.
 * @param {Record<string, any> | null} [data=null] - An optional object containing additional data to be logged.
 *                                                   If provided, it will be JSON.stringified for clear output.
 * @returns {void}
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
 * Logs an error message to the console with a timestamp.
 * This function standardizes error logging, ensuring that all errors are captured
 * in a consistent format, which aids in debugging and monitoring.
 *
 * @param {string} message - A descriptive message explaining the context of the error.
 * @param {any | null} [error=null] - The actual error object or any relevant details.
 *                                    If it's an Error object, its stack will be logged.
 * @returns {void}
 */
export function errorLog(message: string, error: any | null = null): void {
	const timestamp = new Date().toISOString();
	if (error) {
		console.error(`[${timestamp}] ERROR: ${message}:`, error instanceof Error ? error.stack : JSON.stringify(error));
	} else {
		console.error(`[${timestamp}] ERROR: ${message}`);
	}
}

/**
 * Generates a short, random, alphanumeric ID.
 * This is used to create unique identifiers for requests and responses, which is
 * crucial for tracing and debugging in a distributed system.
 *
 * @param {number} [length=12] - The desired length of the generated ID.
 * @returns {string} A random alphanumeric string of the specified length.
 */
export function generateId(length = 12): string {
    return Math.random().toString(36).substring(2, 2 + length);
}