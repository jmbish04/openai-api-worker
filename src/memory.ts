/**
 * @file src/memory.ts
 * @description This file contains functions for managing conversation memory using
 *              Cloudflare's KV storage. It allows the worker to maintain context
 *              across multiple requests by saving and retrieving conversation history.
 *              This feature enables more coherent and stateful interactions with the AI models.
 *              Memory is isolated using a user-provided `memory_keyword`.
 */

import type { ChatMessage } from './types';
import { debugLog } from './utils';

/**
 * Retrieves and prepends conversation history from KV storage to the message list.
 * If a `memoryKeyword` is provided, this function constructs a KV key, fetches the
 * stored context, and adds it as a `system` message at the beginning of the conversation.
 *
 * @param {ChatMessage[]} messages - The original array of chat messages from the request.
 * @param {string | null} memoryKeyword - The keyword used to isolate the conversation memory.
 * @param {Env} env - The worker's environment, providing access to the `AI_MEMORY` KV namespace.
 * @returns {Promise<ChatMessage[]>} A new array of messages, potentially with the added memory context.
 *                                    Returns the original array if no memory is found or if the keyword is null.
 */
export async function addMemoryContext(messages: ChatMessage[], memoryKeyword: string | null, env: Env): Promise<ChatMessage[]> {
    try {
        if (!memoryKeyword) return messages;

        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        if (!lastUserMessage) return messages;

        // Create a consistent key based on the memory keyword and the last user message.
        const contextKey = `memory:${memoryKeyword}:${Buffer.from(lastUserMessage.content).toString('base64').slice(0, 20)}`;
        
        const memoryData = await env.AI_MEMORY.get(contextKey);
        if (!memoryData) return messages;

        const memory = JSON.parse(memoryData);
        
        const systemMessage: ChatMessage = {
            role: 'system',
            content: `Previous context (${memoryKeyword}): ${memory.context || 'No previous context available.'}`
        };

        // Prepend the context to the message history.
        return [systemMessage, ...messages];
    } catch (error) {
        debugLog(env, 'Error adding memory context', { error: error instanceof Error ? error.message : String(error) });
        return messages; // Fail gracefully by returning original messages.
    }
}

/**
 * Saves the context of a conversation (user's last message and AI's response) to KV storage.
 * This allows the context to be retrieved in subsequent requests using the same `memoryKeyword`.
 * The stored data has a TTL of 24 hours.
 *
 * @param {ChatMessage[]} messages - The array of messages from the request.
 * @param {string} response - The AI's response content.
 * @param {string | null} memoryKeyword - The keyword used to isolate the conversation memory.
 * @param {Env} env - The worker's environment, providing access to the `AI_MEMORY` KV namespace.
 * @returns {Promise<void>} A promise that resolves when the memory has been saved.
 */
export async function saveMemoryContext(messages: ChatMessage[], response: string, memoryKeyword: string | null, env: Env): Promise<void> {
    try {
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
 * Searches through all memories associated with a specific keyword for a given query string.
 * This function lists all keys for the keyword, retrieves each value, and performs a case-insensitive search.
 *
 * @param {string} memoryKeyword - The keyword for the memory namespace to search within.
 * @param {string} query - The string to search for within the stored memory contexts.
 * @param {Env} env - The worker's environment, providing access to the `AI_MEMORY` KV namespace.
 * @returns {Promise<string[]>} A promise that resolves to an array of memory contexts that match the query.
 */
export async function searchMemories(memoryKeyword: string, query: string, env: Env): Promise<string[]> {
    try {
        if (!memoryKeyword) return [];

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
 * Deletes all key-value pairs associated with a specific memory keyword from KV storage.
 * This is a destructive operation that allows for the complete removal of a conversation history.
 *
 * @param {string} memoryKeyword - The keyword for the memory namespace to be cleared.
 * @param {Env} env - The worker's environment, providing access to the `AI_MEMORY` KV namespace.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the deletion was successful, and `false` otherwise.
 */
export async function clearMemories(memoryKeyword: string, env: Env): Promise<boolean> {
    try {
        if (!memoryKeyword) return false;

        const listResult = await env.AI_MEMORY.list({ prefix: `memory:${memoryKeyword}:` });
        
        for (const key of listResult.keys) {
            await env.AI_MEMORY.delete(key.name);
        }
        
        return true;
    } catch (error) {
        debugLog(env, 'Error clearing memories', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}