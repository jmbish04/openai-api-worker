
import OpenAI from 'openai';
import { saveMemoryContext } from '../memory';
import { debugLog, errorLog, generateId } from '../utils';

export async function handleOpenAIRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
        if (!env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }
        
        debugLog(env, 'Making OpenAI API request', { model: params.model });
        
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        
        const completion = await openai.chat.completions.create(params);

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

export async function handleOpenAIStructuredRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleOpenAIRequest(params, env, corsHeaders);
}

export async function handleOpenAITextRequest(params: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    return handleOpenAIRequest(params, env, corsHeaders);
}
