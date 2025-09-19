

import { ChatMessage } from './types';
import { debugLog } from './utils';

/**
 * Adds memory context from KV storage to messages using keyword-based isolation
 */
export async function addMemoryContext(messages: ChatMessage[], memoryKeyword: string | null, env: Env): Promise<ChatMessage[]> {
    try {
        // If no memory keyword provided, return original messages
        if (!memoryKeyword) return messages;

        // Get the last user message to extract context
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        if (!lastUserMessage) return messages;

        // Create keyword-based context key
        const contextKey = `memory:${memoryKeyword}:${Buffer.from(lastUserMessage.content).toString('base64').slice(0, 20)}`;
        
        // Try to get relevant memory from KV
        const memoryData = await env.AI_MEMORY.get(contextKey);
        if (!memoryData) return messages;

        const memory = JSON.parse(memoryData);
        
        // Add memory context to the system message or create one
        const systemMessage: ChatMessage = {
            role: 'system',
            content: `Previous context (${memoryKeyword}): ${memory.context || 'No previous context available.'}`
        };

        // Insert system message at the beginning
        return [systemMessage, ...messages];
    } catch (error) {
        debugLog(env, 'Error adding memory context', { error: error instanceof Error ? error.message : String(error) });
        return messages; // Return original messages if memory fails
    }
}

/**
 * Saves conversation context to KV memory using keyword-based isolation
 */
export async function saveMemoryContext(messages: ChatMessage[], response: string, memoryKeyword: string | null, env: Env): Promise<void> {
    try {
        // If no memory keyword provided, don't save memory
        if (!memoryKeyword) return;

        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        if (!lastUserMessage) return;

        const contextKey = `memory:${memoryKeyword}:${Buffer.from(lastUserMessage.content).toString('base64').slice(0, 20)}`;
        const memoryData = {
            context: `${lastUserMessage.content}\n\nResponse: ${response}`,
            timestamp: Date.now(),
            model: 'ai-conversation',
            keyword: memoryKeyword
        };

        await env.AI_MEMORY.put(contextKey, JSON.stringify(memoryData), {
            expirationTtl: 86400 // 24 hours
        });
    } catch (error) {
        debugLog(env, 'Error saving memory context', { error: error instanceof Error ? error.message : String(error) });
    }
}

/**
 * Searches for memories by keyword
 */
export async function searchMemories(memoryKeyword: string, query: string, env: Env): Promise<string[]> {
    try {
        if (!memoryKeyword) return [];

        // Get all keys for this memory keyword
        const listResult = await env.AI_MEMORY.list({ prefix: `memory:${memoryKeyword}:` });
        
        const memories: string[] = [];
        for (const key of listResult.keys) {
            const memoryData = await env.AI_MEMORY.get(key.name);
            if (memoryData) {
                const memory = JSON.parse(memoryData);
                if (memory.context && memory.context.toLowerCase().includes(query.toLowerCase())) {
                    memories.push(memory.context);
                }
            }
        }
        
        return memories;
    } catch (error) {
        debugLog(env, 'Error searching memories', { error: error instanceof Error ? error.message : String(error) });
        return [];
    }
}

/**
 * Clears all memories for a specific keyword
 */
export async function clearMemories(memoryKeyword: string, env: Env): Promise<boolean> {
    try {
        if (!memoryKeyword) return false;

        // Get all keys for this memory keyword
        const listResult = await env.AI_MEMORY.list({ prefix: `memory:${memoryKeyword}:` });
        
        // Delete all memories for this keyword
        for (const key of listResult.keys) {
            await env.AI_MEMORY.delete(key.name);
        }
        
        return true;
    } catch (error) {
        debugLog(env, 'Error clearing memories', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}

