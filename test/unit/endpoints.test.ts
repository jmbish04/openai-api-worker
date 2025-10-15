import test from 'node:test';
import assert from 'node:assert/strict';

import { runEndpointHealthChecks } from '../../src/health';
import { handleRequest } from '../../src/index';
import type { Env } from '../../src/types';

type MemoryStore = Map<string, string>;

function createMemoryBinding(): Env['AI_MEMORY'] {
        const store: MemoryStore = new Map();
        return {
                async get(key: string) {
                        return store.get(key) ?? null;
                },
                async put(key: string, value: string) {
                        store.set(key, value);
                },
                async delete(key: string) {
                        store.delete(key);
                },
                async list({ prefix }: { prefix: string }) {
                        const keys = Array.from(store.keys())
                                .filter((key) => key.startsWith(prefix))
                                .map((name) => ({ name }));
                        return { keys };
                },
        } as Env['AI_MEMORY'];
}

function createAssetsBinding(): Env['ASSETS'] {
        return {
                async fetch(input: RequestInfo | URL) {
                        const url = new URL(typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString());
                        const path = url.pathname;
                        if (path === '/index.html') {
                                return new Response('<html><body>Test Landing</body></html>', {
                                        headers: { 'Content-Type': 'text/html' },
                                });
                        }
                        if (path === '/openapi.json') {
                                return new Response(JSON.stringify({ openapi: '3.1.0', paths: {} }), {
                                        headers: { 'Content-Type': 'application/json' },
                                });
                        }
                        if (path === '/health.html') {
                                return new Response('<html><body>Health Page</body></html>', {
                                        headers: { 'Content-Type': 'text/html' },
                                });
                        }
                        return new Response('Not found', { status: 404 });
                },
        } as Env['ASSETS'];
}

function createStubEnv(): Env {
        const env = {
                DEBUG_LOGGING: 'true',
                WORKER_API_KEY: 'test-key',
                DEFAULT_MODEL: '@cf/meta/llama-4-scout-17b-16e-instruct',
                BACKUP_MODEL: '@cf/openai/gpt-oss-120b',
                AI: {
                        async run() {
                                return {
                                        response: 'Structured response from stub AI',
                                };
                        },
                },
                CORE_API: {
                        async fetch() {
                                return new Response(
                                        JSON.stringify({ providers: { meta: [{ id: '@cf/meta/llama-4-scout-17b-16e-instruct', task: { name: 'text' } }] } }),
                                        { headers: { 'Content-Type': 'application/json' } },
                                );
                        },
                },
                ASSETS: createAssetsBinding(),
                AI_MEMORY: createMemoryBinding(),
        } as unknown as Env;

        return env;
}

function createFetcher(env: Env) {
        return (request: Request) => handleRequest(request, env);
}

const BASE_URL = 'https://unit.test';

test('endpoint health suite passes with stub environment', async () => {
        const env = createStubEnv();
        const fetcher = createFetcher(env);
        const report = await runEndpointHealthChecks(fetcher, env, {
                baseUrl: BASE_URL,
                includeHealthEndpointTest: true,
        });

        assert.equal(report.status, 'pass', 'Health suite should pass for stub env');
        assert.equal(report.summary.failed, 0);
        assert(report.summary.total >= 8, 'Expected at least 8 health tests to run');

        const structuredTest = report.tests.find((t) => t.name.includes('Structured chat completions'));
        assert(structuredTest, 'Structured test should exist');
        assert.equal(structuredTest.status, 'pass');
});

test('health endpoint returns report payload', async () => {
        const env = createStubEnv();
        const response = await handleRequest(new Request(`${BASE_URL}/health`), env);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(typeof payload.status, 'string');
        assert(Array.isArray(payload.tests));
        assert(payload.summary.total >= payload.summary.passed);
});
