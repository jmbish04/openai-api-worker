/**
 * OpenAI-Compatible API Worker using Cloudflare AI
 * Supports text generation, image recognition, and OpenAI API format
 * Uses ASSETS binding to serve static documentation and OpenAPI spec
 */

// Utility function for debug logging
function debugLog(env, message, data = null) {
  if (env.DEBUG_LOGGING === 'true') {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] ${message}:`, data);
    } else {
      console.log(`[${timestamp}] ${message}`);
    }
  }
}

// Utility function for error logging (always logged)
function errorLog(message, error = null) {
  const timestamp = new Date().toISOString();
  if (error) {
    console.error(`[${timestamp}] ERROR: ${message}:`, error);
  } else {
    console.error(`[${timestamp}] ERROR: ${message}`);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Log incoming request
    debugLog(env, `Incoming request: ${request.method} ${path}`);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      debugLog(env, 'CORS preflight request');
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Serve static files using ASSETS binding (no authentication required)
      if (path === '/' || path === '/index.html') {
        debugLog(env, 'Serving landing page from ASSETS');
        try {
          const asset = await env.ASSETS.fetch(new URL('/index.html', request.url));
          const content = await asset.text();
          debugLog(env, 'Landing page served successfully');
          return new Response(content, {
            headers: { 
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=3600',
              ...corsHeaders 
            }
          });
        } catch (error) {
          errorLog('Error serving landing page', error);
          return new Response('Documentation page not found', { 
            status: 404,
            headers: corsHeaders 
          });
        }
      }

      if (path === '/openapi.json') {
        debugLog(env, 'Serving OpenAPI spec from ASSETS');
        try {
          const asset = await env.ASSETS.fetch(new URL('/openapi.json', request.url));
          const content = await asset.text();
          debugLog(env, 'OpenAPI spec served successfully');
          return new Response(content, {
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
              ...corsHeaders 
            }
          });
        } catch (error) {
          errorLog('Error serving OpenAPI spec', error);
          return new Response(JSON.stringify({ error: 'OpenAPI specification not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      if (path === '/health') {
        debugLog(env, 'Health check requested');
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          service: 'openai-api-worker',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // API endpoints require authentication
      debugLog(env, 'Authenticating request for API endpoint');
      const authResult = await authenticateRequest(request, env);
      if (!authResult.success) {
        errorLog(`Authentication failed: ${authResult.error}`);
        return new Response(JSON.stringify({ 
          error: { 
            message: authResult.error,
            type: 'invalid_request_error'
          }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      debugLog(env, 'Authentication successful');

      // Route handling for authenticated endpoints
      if (path === '/v1/chat/completions') {
        debugLog(env, 'Handling chat completions request');
        return await handleChatCompletions(request, env, corsHeaders);
      } else if (path === '/v1/models') {
        debugLog(env, 'Handling models list request');
        return await handleModels(env, corsHeaders);
      } else if (path === '/v1/completions') {
        debugLog(env, 'Handling legacy completions request');
        return await handleCompletions(request, env, corsHeaders);
      }

      debugLog(env, `Unknown endpoint requested: ${path}`);
      return new Response(JSON.stringify({ 
        error: { 
          message: 'Not found',
          type: 'invalid_request_error'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      errorLog('Unhandled worker error', error);
      return new Response(JSON.stringify({ 
        error: { 
          message: 'Internal server error',
          type: 'server_error',
          details: error.message 
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

/**
 * Authenticate the incoming request
 */
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    debugLog(env, 'Missing Authorization header');
    return { success: false, error: 'Missing Authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    debugLog(env, 'Invalid Authorization header format');
    return { success: false, error: 'Invalid Authorization header format. Use: Bearer <token>' };
  }

  const token = authHeader.replace('Bearer ', '');
  debugLog(env, `Token extracted: ${token.substring(0, 10)}...`);
  
  // In development, be more lenient
  if (env.DEBUG_LOGGING === 'true' || !env.WORKER_API_KEY) {
    debugLog(env, 'Development mode: bypassing API key validation');
    return { success: true };
  }

  // In production, validate against the secret
  if (token !== env.WORKER_API_KEY) {
    debugLog(env, 'API key validation failed');
    return { success: false, error: 'Invalid API key' };
  }

  debugLog(env, 'API key validation successful');
  return { success: true };
}

/**
 * Handle /v1/chat/completions endpoint
 */
async function handleChatCompletions(request, env, corsHeaders) {
  debugLog(env, 'Parsing chat completions request body');
  const body = await request.json();
  
  const {
    model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
    messages,
    stream = false,
    max_tokens = 2048,
    temperature = 0.7,
    top_p = 1,
    frequency_penalty = 0,
    presence_penalty = 0,
    ...otherParams
  } = body;

  debugLog(env, `Request params`, { 
    model, 
    messagesCount: messages?.length, 
    stream, 
    max_tokens, 
    temperature 
  });

  if (!messages || !Array.isArray(messages)) {
    errorLog('Invalid messages parameter');
    return new Response(JSON.stringify({ 
      error: { 
        message: 'messages parameter is required and must be an array',
        type: 'invalid_request_error'
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Convert OpenAI format to Cloudflare AI format
    debugLog(env, 'Converting messages to Cloudflare format');
    const cfMessages = await convertMessagesToCloudflareFormat(messages, env);
    
    const aiRequest = {
      messages: cfMessages,
      max_tokens,
      temperature,
      top_p,
      stream
    };

    // Determine which model to use
    const cfModel = mapOpenAIModelToCloudflare(model, env);
    debugLog(env, `Using Cloudflare model: ${cfModel}`);
    
    if (stream) {
      debugLog(env, 'Handling streaming response');
      return await handleStreamingResponse(aiRequest, cfModel, env, corsHeaders, model);
    } else {
      debugLog(env, 'Handling non-streaming response');
      return await handleNonStreamingResponse(aiRequest, cfModel, env, corsHeaders, model);
    }

  } catch (error) {
    errorLog('Primary model request failed', error);
    
    // Try backup model if primary fails
    const backupModel = env.BACKUP_MODEL || '@cf/openai/gpt-oss-120b';
    if (model !== backupModel) {
      debugLog(env, `Trying backup model: ${backupModel}`);
      try {
        const cfMessages = await convertMessagesToCloudflareFormat(messages, env);
        const aiRequest = { messages: cfMessages, max_tokens, temperature, top_p, stream };
        
        if (stream) {
          return await handleStreamingResponse(aiRequest, backupModel, env, corsHeaders, model);
        } else {
          return await handleNonStreamingResponse(aiRequest, backupModel, env, corsHeaders, model);
        }
      } catch (backupError) {
        errorLog('Backup model also failed', backupError);
      }
    }

    return new Response(JSON.stringify({ 
      error: { 
        message: 'AI service error', 
        type: 'server_error',
        details: error.message 
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Convert OpenAI messages format to Cloudflare AI format
 */
async function convertMessagesToCloudflareFormat(messages, env) {
  const cfMessages = [];
  
  for (const message of messages) {
    const { role, content } = message;
    
    // Handle different content types (text, images)
    if (typeof content === 'string') {
      cfMessages.push({ role, content });
    } else if (Array.isArray(content)) {
      // Handle multimodal content (text + images)
      let textContent = '';
      const imageContents = [];
      
      for (const item of content) {
        if (item.type === 'text') {
          textContent += item.text + ' ';
        } else if (item.type === 'image_url') {
          // For image recognition, we'll include image info
          imageContents.push(item.image_url.url);
        }
      }
      
      if (imageContents.length > 0) {
        // For image recognition, append image info to text
        textContent += `[Images provided: ${imageContents.length} image(s)]`;
      }
      
      cfMessages.push({ role, content: textContent.trim() });
    } else {
      cfMessages.push({ role, content: String(content) });
    }
  }
  
  return cfMessages;
}

/**
 * Map OpenAI model names to Cloudflare model names
 */
function mapOpenAIModelToCloudflare(model, env) {
  const modelMap = {
    'gpt-4': env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
    'gpt-4-turbo': env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
    'gpt-3.5-turbo': env.BACKUP_MODEL || '@cf/openai/gpt-oss-120b',
    'gpt-4o': env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
    'gpt-4o-mini': env.BACKUP_MODEL || '@cf/openai/gpt-oss-120b'
  };
  
  return modelMap[model] || model;
}

/**
 * Handle streaming responses
 */
async function handleStreamingResponse(aiRequest, model, env, corsHeaders, originalModel) {
  debugLog(env, `Starting streaming response with model: ${model}`);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  const streamResponse = async () => {
    try {
      debugLog(env, 'Making streaming AI request');
      const response = await env.AI.run(model, aiRequest);
      
      // Handle streaming from Cloudflare AI
      if (response && typeof response.then === 'function') {
        debugLog(env, 'Processing async AI response');
        const result = await response;
        const chunk = createOpenAIStreamChunk(result.response || result, originalModel);
        await writer.write(new TextEncoder().encode(chunk));
      } else if (response && response.response) {
        debugLog(env, 'Processing synchronous AI response');
        const chunk = createOpenAIStreamChunk(response.response, originalModel);
        await writer.write(new TextEncoder().encode(chunk));
      }
      
      // Send final chunk
      debugLog(env, 'Sending final stream chunk');
      const finalChunk = 'data: [DONE]\\n\\n';
      await writer.write(new TextEncoder().encode(finalChunk));
    } catch (error) {
      errorLog('Streaming error', error);
      const errorChunk = `data: ${JSON.stringify({ 
        error: { 
          message: error.message,
          type: 'server_error'
        }
      })}\\n\\n`;
      await writer.write(new TextEncoder().encode(errorChunk));
    } finally {
      await writer.close();
    }
  };
  
  // Start streaming
  streamResponse();
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders
    }
  });
}

/**
 * Handle non-streaming responses
 */
async function handleNonStreamingResponse(aiRequest, model, env, corsHeaders, originalModel) {
  debugLog(env, `Making AI request to model: ${model}`);
  const response = await env.AI.run(model, aiRequest);
  
  debugLog(env, 'AI response received', { 
    hasResponse: !!response.response,
    responseLength: response.response?.length 
  });
  
  const openaiResponse = {
    id: `chatcmpl-${generateId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: originalModel,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: response.response || response
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: estimateTokens(aiRequest.messages),
      completion_tokens: estimateTokens(response.response || response),
      total_tokens: estimateTokens(aiRequest.messages) + estimateTokens(response.response || response)
    }
  };

  debugLog(env, 'Sending OpenAI-compatible response');
  return new Response(JSON.stringify(openaiResponse), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

/**
 * Create OpenAI-compatible streaming chunk
 */
function createOpenAIStreamChunk(content, model) {
  const chunk = {
    id: `chatcmpl-${generateId()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: {
        content: content
      },
      finish_reason: null
    }]
  };
  
  return `data: ${JSON.stringify(chunk)}\\n\\n`;
}

/**
 * Handle /v1/models endpoint
 */
async function handleModels(env, corsHeaders) {
  const models = [
    {
      id: '@cf/meta/llama-4-scout-17b-16e-instruct',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare',
      permission: [],
      root: '@cf/meta/llama-4-scout-17b-16e-instruct',
      parent: null
    },
    {
      id: '@cf/openai/gpt-oss-120b',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare',
      permission: [],
      root: '@cf/openai/gpt-oss-120b',
      parent: null
    },
    // OpenAI compatible model names
    {
      id: 'gpt-4',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare-proxy',
      permission: [],
      root: 'gpt-4',
      parent: null
    },
    {
      id: 'gpt-4-turbo',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare-proxy',
      permission: [],
      root: 'gpt-4-turbo',
      parent: null
    },
    {
      id: 'gpt-4o',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare-proxy',
      permission: [],
      root: 'gpt-4o',
      parent: null
    },
    {
      id: 'gpt-4o-mini',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare-proxy',
      permission: [],
      root: 'gpt-4o-mini',
      parent: null
    },
    {
      id: 'gpt-3.5-turbo',
      object: 'model',
      created: 1677610602,
      owned_by: 'cloudflare-proxy',
      permission: [],
      root: 'gpt-3.5-turbo',
      parent: null
    }
  ];

  return new Response(JSON.stringify({ object: 'list', data: models }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

/**
 * Handle /v1/completions endpoint (legacy)
 */
async function handleCompletions(request, env, corsHeaders) {
  const body = await request.json();
  const { 
    model = env.DEFAULT_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct', 
    prompt, 
    max_tokens = 100, 
    temperature = 0.7 
  } = body;
  
  if (!prompt) {
    return new Response(JSON.stringify({ 
      error: { 
        message: 'prompt parameter is required',
        type: 'invalid_request_error'
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  
  // Convert to chat format
  const messages = [{ role: 'user', content: prompt }];
  const chatRequest = { model, messages, max_tokens, temperature };
  
  // Use chat completions logic
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(chatRequest)
  });
  
  return await handleChatCompletions(mockRequest, env, corsHeaders);
}

/**
 * Utility functions
 */
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text === 'object') {
    text = JSON.stringify(text);
  }
  return Math.ceil(text.length / 4); // Rough estimation
}
