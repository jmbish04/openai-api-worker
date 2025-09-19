/**
 * @file src/handlers/openai.ts
 * @description This file contains the request handler for OpenAI models.
 *              It uses the official OpenAI Node.js SDK to interact with the OpenAI API.
 *              The handler is responsible for creating a chat completion request,
 *              handling both streaming and non-streaming responses, and saving
 *              conversation context to KV memory. It also formats the final response
 *              to be compatible with the OpenAI API standard.
 * 
 *              This handler includes intelligent fallback for structured outputs:
 *              - Uses response_format: json_schema for supported 4o models
 *              - Falls back to tools+strict for other models that support function calling
 */

import OpenAI from 'openai';
import { saveMemoryContext } from '../memory';
import { debugLog, errorLog, generateId } from '../utils';

// Minimal allowlist for json_schema-capable SKUs (expand if you confirm others)
const JSON_SCHEMA_MODELS = [
  'gpt-4o',               // generic 4o alias usually maps to a dated release that supports json_schema
  'gpt-4o-2024-08-06',    // explicitly documented
  'gpt-4o-mini-2024-07-18'// supported in some tenants; if you see 400s, remove this entry
];

function supportsJsonSchema(modelId: string): boolean {
  const id = (modelId || '').toLowerCase();
  return JSON_SCHEMA_MODELS.some(m => id.startsWith(m));
}

// Build a tools+strict function from a JSON Schema object
function schemaToTool(schema: any) {
  return {
    type: 'function' as const,
    function: {
      name: '__structured_output__',
      description: 'Return a JSON object that strictly matches this schema.',
      parameters: schema,     // JSON Schema
      strict: true            // enforce exact structure
    }
  };
}

/**
 * Handles a chat completion request directed to the OpenAI API.
 *
 * This function manages the interaction with OpenAI's API:
 * 1.  Checks for the presence of the `OPENAI_API_KEY`.
 * 2.  Initializes the OpenAI SDK.
 * 3.  Handles structured outputs intelligently:
 *     - Uses response_format: json_schema for supported 4o models
 *     - Falls back to tools+strict for other function-calling models
 * 4.  Calls the `chat.completions.create` method with the provided parameters.
 * 5.  If streaming is enabled, it returns the raw stream from the SDK.
 * 6.  If streaming is disabled, it awaits the full response.
 * 7.  Normalizes responses from tools+strict fallback to maintain compatibility.
 * 8.  Saves the conversation context to KV memory if a `memory_keyword` is present.
 * 9.  Returns the completion response, either as a stream or a complete JSON object.
 * 10. Includes robust error handling to manage API failures gracefully.
 *
 * @param {any} params - An object containing all necessary parameters for the OpenAI API call,
 *                       such as `model`, `messages`, `stream`, etc.
 * @param {Env} env - The worker's environment, containing the `OPENAI_API_KEY`.
 * @param {Record<string, string>} corsHeaders - The CORS headers to be included in the response.
 * @returns {Promise<Response>} A promise that resolves to the final `Response` object.
 */
export async function handleOpenAIRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        if (!env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        // Strip internal fields
        const { modelType, originalModel, memory, memory_keyword, ...apiParams } = params;
        const modelId = apiParams.model;

        // --- Structured output handling ---
        // If caller asked for response_format: json_schema, either pass it through (4o-only)
        // or transparently fall back to tools+strict.
        if (apiParams.response_format?.type === 'json_schema') {
            const schema = apiParams.response_format.json_schema?.schema || apiParams.response_format.schema;
            if (!schema) {
                throw new Error("response_format.json_schema.schema is required when using type='json_schema'");
            }

            if (supportsJsonSchema(modelId)) {
                // Ensure additionalProperties is set to false for OpenAI compatibility
                const normalizedSchema = { ...schema };
                if (normalizedSchema.type === 'object' && !('additionalProperties' in normalizedSchema)) {
                    normalizedSchema.additionalProperties = false;
                }
                
                // normalize shape to what OpenAI expects
                apiParams.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: apiParams.response_format.json_schema?.name || apiParams.response_format.schema?.name || 'response_schema',
                        schema: normalizedSchema,
                        strict: true
                    }
                };
                debugLog(env, 'Using json_schema response_format for model', { modelId });
            } else {
                // Fallback: convert to tools+strict
                debugLog(env, 'Model does not support json_schema; falling back to tools+strict', { modelId });

                // Ensure additionalProperties is set to false for consistency
                const normalizedSchema = { ...schema };
                if (normalizedSchema.type === 'object' && !('additionalProperties' in normalizedSchema)) {
                    normalizedSchema.additionalProperties = false;
                }

                // remove incompatible param
                delete apiParams.response_format;

                // ensure tools array exists and add our tool
                apiParams.tools = Array.isArray(apiParams.tools) ? apiParams.tools.slice() : [];
                apiParams.tools.push(schemaToTool(normalizedSchema));

                // force tool_choice to our function to get arguments back
                apiParams.tool_choice = { type: 'function', function: { name: '__structured_output__' } };
            }
        }

        debugLog(env, 'Making OpenAI API request', { model: modelId });

        const completion = await openai.chat.completions.create(apiParams);

        // --- Normalize response when we used tools+strict fallback ---
        if (!supportsJsonSchema(modelId) && apiParams.tool_choice?.type === 'function') {
            const msg = (completion as any).choices?.[0]?.message;
            const tc = msg?.tool_calls?.[0]?.function;
            if (tc?.name === '__structured_output__' && typeof tc?.arguments === 'string') {
                // Put the JSON string into message.content for downstream compatibility
                const cloned = JSON.parse(JSON.stringify(completion));
                if (cloned.choices?.[0]?.message) {
                    cloned.choices[0].message.content = tc.arguments; // JSON string
                    // optional: also expose parsed object in a vendor field
                    (cloned.choices[0].message as any)._structured_arguments = JSON.parse(tc.arguments);
                }
                if (params.stream) {
                    // If you stream with tools, you should stream SSE and stitch deltas.
                    // Your current code returns the SDK stream verbatim; leaving as-is.
                    return new Response(completion as any, {
                        headers: { 'Content-Type': 'text/event-stream', ...corsHeaders }
                    });
                } else {
                    const responseText = cloned.choices[0]?.message?.content || '';
                    await saveMemoryContext(params.messages, responseText, params.memory_keyword, env);
                    return new Response(JSON.stringify(cloned), {
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }
            }
        }

        // --- Regular return paths ---
        if (params.stream) {
            return new Response(completion as any, {
                headers: { 'Content-Type': 'text/event-stream', ...corsHeaders }
            });
        } else {
            const responseText = (completion as any).choices[0]?.message?.content || '';
            await saveMemoryContext(params.messages, responseText, params.memory_keyword, env);
            return new Response(JSON.stringify(completion), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    } catch (error) {
        errorLog('OpenAI request failed', error);
        const errorResponse = {
            error: {
                message: 'OpenAI API error',
                type: 'api_error',
                details: error instanceof Error ? error.message : 'Unknown OpenAI error',
                request_id: generateId()
            }
        };
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

/**
 * A wrapper function for handling structured chat completion requests with OpenAI.
 * It delegates directly to the main `handleOpenAIRequest` function, as the core
 * SDK call is the same. The structured response parameters are assumed to be in `params`.
 */
export async function handleOpenAIStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleOpenAIRequest(params, env, corsHeaders);
}

/**
 * A wrapper function for handling text-only chat completion requests with OpenAI.
 * It delegates directly to the main `handleOpenAIRequest` function.
 */
export async function handleOpenAITextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleOpenAIRequest(params, env, corsHeaders);
}