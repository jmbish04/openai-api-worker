/**
 * @file src/types.ts
 * @description This file contains all the core TypeScript type definitions and interfaces
 *              used throughout the OpenAI-compatible API worker. Defining types in a central
 *              location helps ensure consistency and improves code readability and maintainability.
 *              It serves as a single source of truth for the data structures passed between
 *              different modules of the worker.
 */



// --- Core API Object Types ---

/**
 * Represents the structure of a single chat message within an OpenAI API request.
 * This interface is fundamental for handling conversations.
 *
 * @property {'system' | 'user' | 'assistant'} role - The originator of the message.
 *   - `system`: Provides instructions or context to the model.
 *   - `user`: Represents input from the end-user.
 *   - `assistant`: Represents a previous response from the model.
 * @property {string} content - The textual content of the message.
 */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Defines the expected request body structure for the `/v1/chat/completions` endpoint.
 * This interface includes standard OpenAI parameters as well as custom additions for this worker.
 *
 * @property {string} [model] - The ID of the model to use for the completion. Defaults to the value in `env.DEFAULT_MODEL`.
 * @property {ChatMessage[]} messages - An array of message objects representing the conversation history.
 * @property {boolean} [stream=false] - If true, the response will be streamed as server-sent events.
 * @property {number} [max_tokens=2048] - The maximum number of tokens to generate in the completion.
 * @property {number} [temperature=0.7] - The sampling temperature, controlling randomness. Higher values mean more random output.
 * @property {number} [top_p=1] - The nucleus sampling probability.
 * @property {number} [frequency_penalty=0] - Penalizes new tokens based on their frequency in the text so far.
 * @property {number} [presence_penalty=0] - Penalizes new tokens based on whether they appear in the text so far.
 * @property {object} [response_format] - An object specifying the desired output format (e.g., JSON).
 * @property {'text' | 'json_object' | 'json_schema'} [response_format.type] - The type of response format.
 * @property {any} [response_format.schema] - The JSON schema to use when `type` is `json_schema`.
 * @property {string} [memory_keyword] - A custom keyword for isolating conversation history in KV memory.
 * @property {any} [key: string] - Allows for other arbitrary parameters to be included in the request.
 */
export interface ChatCompletionRequestBody {
	model?: string;
	messages: ChatMessage[];
	stream?: boolean;
	max_tokens?: number;
	temperature?: number;
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	response_format?: {
		type: 'text' | 'json_object' | 'json_schema';
		schema?: any;
	};
	memory?: boolean;
	memory_keyword?: string;
	[key: string]: any;
}

/**
 * Defines the request body for the legacy `/v1/completions` endpoint.
 * This is supported for backward compatibility and is converted internally to a chat completion request.
 *
 * @property {string} [model] - The model to use for the completion.
 * @property {string} prompt - The prompt to generate a completion for.
 * @property {number} [max_tokens] - The maximum number of tokens to generate.
 * @property {number} [temperature] - The sampling temperature.
 * @property {boolean} [stream] - Whether to stream the response.
 */
export interface CompletionRequestBody {
    model?: string;
    prompt: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

/**
 * Represents the structure of a single AI model as returned by the `/v1/models` endpoint.
 * This provides a standardized format for models from any backend provider.
 *
 * @property {string} id - The unique identifier for the model.
 * @property {'model'} object - The object type, always "model".
 * @property {string} owner - The organization or provider that owns the model (e.g., 'cloudflare-meta', 'openai').
 * @property {number} [created] - A Unix timestamp of when the model was created, if available.
 */
export interface ApiModel {
    id: string;
    object: 'model';
    owner: string;
    created?: number;
    tags?: string[];
}

// --- Provider-Specific Types ---

/**
 * Enumerates the supported backend AI providers.
 * This type is used for routing logic to direct requests to the correct service.
 */
export type Provider = 'cloudflare' | 'openai' | 'gemini';

/**
 * Enumerates the types of models, primarily used for Cloudflare to determine
 * the correct message formatting and capabilities.
 * - `llama4`: Advanced Llama models with chat message support.
 * - `llama`: Older Llama models requiring a specific templated string format.
 * - `openai`: OpenAI models or compatible models on Cloudflare.
 * - `gemini`: Google Gemini models.
 * - `input`: A generic fallback for models that take a simple prompt string.
 */
export type ModelType = 'llama4' | 'llama' | 'openai' | 'gemini' | 'input';

/**
 * Represents the detailed structure of a single Cloudflare AI model, as fetched
 * from the internal Core API. This provides richer metadata than the public `ApiModel`.
 *
 * @property {string} id - The internal ID of the model.
 * @property {number} source - A source identifier.
 * @property {string} name - The user-facing name of the model (e.g., '@cf/meta/llama-3-8b-instruct').
 * @property {string} description - A human-readable description of the model.
 * @property {object} task - Information about the model's primary task (e.g., Text Generation).
 * @property {string} task.id - The ID of the task.
 * @property {string} task.name - The name of the task.
 * @property {string} task.description - A description of the task.
 * @property {string} created_at - An ISO 8601 timestamp of when the model was created.
 * @property {string[]} tags - Any tags associated with the model.
 * @property {Array<object>} properties - An array of key-value properties providing additional metadata.
 */
export interface CloudflareAIModel {
	id: string;
	source: number;
	name: string;
	description: string;
	task: {
		id:string;
		name: string;
		description: string;
	};
	created_at: string;
	tags: string[];
	properties: Array<{
		property_id: string;
		value: any;
	}>;
}

/**
 * Represents the top-level structure of the response from the Core API's `/ai/models` endpoint.
 * The models are organized by their provider.
 *
 * @property {Record<string, CloudflareAIModel[]>} providers - A dictionary where keys are provider names
 *   (e.g., 'meta', 'openai') and values are arrays of model details for that provider.
 */
export interface CloudflareAIModelsResponse {
	providers: Record<string, CloudflareAIModel[]>;
}