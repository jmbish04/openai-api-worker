/**
 * @file src/health.ts
 * @description Provides reusable endpoint unit tests that can be executed both
 *              during automated test runs and dynamically from the `/health`
 *              endpoint. The suite exercises every public API surface and
 *              validates error handling paths so it can run safely without
 *              external provider access. When an environment has all bindings
 *              configured, the same suite will exercise live integrations.
 */

export type HealthTestStatus = 'pass' | 'fail';

export interface EndpointTestResult {
        name: string;
        status: HealthTestStatus;
        durationMs: number;
        error?: string;
        details?: Record<string, unknown>;
}

export interface EndpointHealthReport {
        status: HealthTestStatus;
        durationMs: number;
        summary: {
                total: number;
                passed: number;
                failed: number;
        };
        tests: EndpointTestResult[];
}

export interface HealthSuiteOptions {
        baseUrl: string;
        includeHealthEndpointTest?: boolean;
}

export type WorkerFetcher = (request: Request) => Promise<Response>;

interface TestContext {
        fetcher: WorkerFetcher;
        env: Env;
        baseUrl: string;
        authHeader: string;
}

type TestDefinition = {
        name: string;
        run: (ctx: TestContext) => Promise<void>;
};

function buildAuthHeader(env: Env): string {
        const token = env.WORKER_API_KEY || 'health-check-token';
        return `Bearer ${token}`;
}

function createJsonRequest(url: string, body: unknown, authHeader: string): Request {
        return new Request(url, {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader,
                },
                body: JSON.stringify(body),
        });
}

async function expectOkJson(response: Response, errorMessage: string): Promise<any> {
        if (!response.ok) {
                throw new Error(`${errorMessage} (status ${response.status})`);
        }
        const text = await response.text();
        try {
                return JSON.parse(text);
        } catch (error) {
                throw new Error(`${errorMessage}: Failed to parse JSON - ${(error as Error).message}`);
        }
}

function getTests(includeHealthEndpoint: boolean): TestDefinition[] {
        const tests: TestDefinition[] = [
                {
                        name: 'Landing page available',
                        run: async ({ fetcher, baseUrl }) => {
                                const response = await fetcher(new Request(`${baseUrl}/`));
                                if (!response.ok) {
                                        throw new Error(`Expected 200 for landing page, got ${response.status}`);
                                }
                                const html = await response.text();
                                if (!html.includes('<html')) {
                                        throw new Error('Landing page did not return HTML content');
                                }
                        },
                },
                {
                        name: 'OpenAPI specification available',
                        run: async ({ fetcher, baseUrl }) => {
                                const response = await fetcher(new Request(`${baseUrl}/openapi.json`));
                                const data = await expectOkJson(response, 'Failed to load /openapi.json');
                                if (!data.paths || typeof data.paths !== 'object') {
                                        throw new Error('OpenAPI document missing `paths` definition');
                                }
                        },
                },
                {
                        name: 'Models endpoint returns list',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const request = new Request(`${baseUrl}/v1/models`, {
                                        headers: { Authorization: authHeader },
                                });
                                const data = await expectOkJson(await fetcher(request), 'Failed to query /v1/models');
                                if (!Array.isArray(data.data)) {
                                        throw new Error('Models response missing `data` array');
                                }
                        },
                },
                {
                        name: 'Legacy completions validation errors',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const response = await fetcher(
                                        createJsonRequest(
                                                `${baseUrl}/v1/completions`,
                                                { model: 'gpt-4o-mini' },
                                                authHeader,
                                        ),
                                );
                                if (response.status !== 400) {
                                        throw new Error(`Expected 400 for missing prompt, received ${response.status}`);
                                }
                        },
                },
                {
                        name: 'Chat completions validation errors',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const response = await fetcher(
                                        createJsonRequest(
                                                `${baseUrl}/v1/chat/completions`,
                                                { model: '@cf/meta/llama-4-scout-17b-16e-instruct' },
                                                authHeader,
                                        ),
                                );
                                if (response.status !== 400) {
                                        throw new Error(`Expected 400 for missing messages, received ${response.status}`);
                                }
                        },
                },
                {
                        name: 'Text chat completions validation errors',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const response = await fetcher(
                                        createJsonRequest(
                                                `${baseUrl}/v1/chat/completions/text`,
                                                { model: '@cf/meta/llama-4-scout-17b-16e-instruct' },
                                                authHeader,
                                        ),
                                );
                                if (response.status !== 400) {
                                        throw new Error(`Expected 400 for missing messages, received ${response.status}`);
                                }
                        },
                },
                {
                        name: 'Completions with memory validation errors',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const response = await fetcher(
                                        createJsonRequest(
                                                `${baseUrl}/v1/completions/withmemory`,
                                                {
                                                        model: '@cf/meta/llama-4-scout-17b-16e-instruct',
                                                        memory: false,
                                                },
                                                authHeader,
                                        ),
                                );
                                if (response.status !== 400) {
                                        throw new Error(`Expected 400 for invalid memory flags, received ${response.status}`);
                                }
                        },
                },
                {
                        name: 'Structured chat completions (llama-4)',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const response = await fetcher(
                                        createJsonRequest(
                                                `${baseUrl}/v1/chat/completions/structured`,
                                                {
                                                        model: '@cf/meta/llama-4-scout-17b-16e-instruct',
                                                        messages: [
                                                                { role: 'user', content: 'Return a JSON object with status and details.' },
                                                        ],
                                                        response_format: {
                                                                type: 'json_schema',
                                                                schema: {
                                                                        name: 'HealthResponse',
                                                                        schema: {
                                                                                type: 'object',
                                                                                properties: {
                                                                                        status: { type: 'string' },
                                                                                        details: { type: 'string' },
                                                                                },
                                                                                required: ['status'],
                                                                        },
                                                                },
                                                        },
                                                },
                                                authHeader,
                                        ),
                                );
                                const completion = await expectOkJson(response, 'Structured completion failed');
                                const content = completion?.choices?.[0]?.message?.content;
                                if (typeof content !== 'string' || content.length === 0) {
                                        throw new Error('Structured completion response missing assistant content');
                                }
                        },
                },
                {
                        name: 'Provider diagnostics endpoint',
                        run: async ({ fetcher, baseUrl, authHeader }) => {
                                const request = new Request(`${baseUrl}/test/apis`, {
                                        headers: { Authorization: authHeader },
                                });
                                const data = await expectOkJson(await fetcher(request), 'Diagnostics endpoint failed');
                                if (!data.tests) {
                                        throw new Error('Diagnostics response missing `tests` object');
                                }
                        },
                },
        ];

        if (includeHealthEndpoint) {
                tests.push({
                        name: 'Health endpoint summary payload',
                        run: async ({ fetcher, baseUrl }) => {
                                const data = await expectOkJson(
                                        await fetcher(new Request(`${baseUrl}/health`)),
                                        'Health endpoint did not respond successfully',
                                );
                                if (!Array.isArray(data.tests)) {
                                        throw new Error('Health endpoint response missing `tests` array');
                                }
                        },
                });
        }

        return tests;
}

async function executeTest(test: TestDefinition, ctx: TestContext): Promise<EndpointTestResult> {
        const start = Date.now();
        try {
                await test.run(ctx);
                return {
                        name: test.name,
                        status: 'pass',
                        durationMs: Date.now() - start,
                };
        } catch (error) {
                return {
                        name: test.name,
                        status: 'fail',
                        durationMs: Date.now() - start,
                        error: error instanceof Error ? error.message : String(error),
                };
        }
}

/**
 * Runs the full endpoint health suite using the provided fetcher and environment.
 *
 * @param fetcher - Function used to execute requests against the worker.
 * @param env - The worker environment (used for auth token discovery).
 * @param options - Suite execution options.
 */
export async function runEndpointHealthChecks(
        fetcher: WorkerFetcher,
        env: Env,
        options: HealthSuiteOptions,
): Promise<EndpointHealthReport> {
        const suiteStart = Date.now();
        const tests = getTests(options.includeHealthEndpointTest ?? false);
        const context: TestContext = {
                fetcher,
                env,
                baseUrl: options.baseUrl,
                authHeader: buildAuthHeader(env),
        };

        const results: EndpointTestResult[] = [];
        for (const test of tests) {
                // Execute sequentially to avoid overwhelming bindings during health checks.
                const result = await executeTest(test, context);
                results.push(result);
        }

        const summary = results.reduce(
                (acc, result) => {
                        acc.total += 1;
                        if (result.status === 'pass') acc.passed += 1;
                        else acc.failed += 1;
                        return acc;
                },
                { total: 0, passed: 0, failed: 0 },
        );

        const status: HealthTestStatus = summary.failed > 0 ? 'fail' : 'pass';

        return {
                status,
                durationMs: Date.now() - suiteStart,
                summary,
                tests: results,
        };
}
