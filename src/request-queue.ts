/**
 * @file src/request-queue.ts
 * @description Provides a lightweight, in-memory request queue that limits the
 *              number of concurrent AI provider calls. This helps the worker
 *              gracefully handle bursts of requests without overwhelming the
 *              upstream providers.
 */

const DEFAULT_CONCURRENCY = 6;
const QUEUE_KEY = '__OPENAI_API_WORKER_REQUEST_QUEUE__';

type Task<T> = () => Promise<T>;

type QueueEntry<T> = {
        task: Task<T>;
        resolve: (value: T) => void;
        reject: (reason?: unknown) => void;
};

class InternalRequestQueue {
        private readonly queue: QueueEntry<unknown>[] = [];
        private active = 0;

        constructor(private readonly concurrencyLimit: number) {}

        get concurrency(): number {
                return this.concurrencyLimit;
        }

        enqueue<T>(task: Task<T>): Promise<T> {
                return new Promise<T>((resolve, reject) => {
                        const entry: QueueEntry<T> = { task, resolve, reject };
                        this.queue.push(entry as QueueEntry<unknown>);
                        this.process();
                });
        }

        private process(): void {
                while (this.active < this.concurrencyLimit && this.queue.length > 0) {
                        const entry = this.queue.shift();
                        if (!entry) {
                                continue;
                        }

                        this.active++;
                        Promise.resolve()
                                .then(() => entry.task())
                                .then((result) => entry.resolve(result))
                                .catch((error) => entry.reject(error))
                                .finally(() => {
                                        this.active--;
                                        this.process();
                                });
                }
        }
}

type QueueHolder = { queue: InternalRequestQueue; concurrency: number };

type GlobalWithQueue = typeof globalThis & {
        [QUEUE_KEY]?: QueueHolder;
};

/**
 * Returns a singleton instance of the request queue, creating it if needed.
 * The concurrency level can be configured with the `REQUEST_CONCURRENCY`
 * environment variable; otherwise, a sensible default is used.
 */
export function getRequestQueue(env: Env): InternalRequestQueue {
        const configuredConcurrency = Number(env.REQUEST_CONCURRENCY);
        const targetConcurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
                ? Math.floor(configuredConcurrency)
                : DEFAULT_CONCURRENCY;

        const globalRef = globalThis as GlobalWithQueue;
        const existing = globalRef[QUEUE_KEY];

        if (!existing || existing.concurrency !== targetConcurrency) {
                const queue = new InternalRequestQueue(targetConcurrency);
                globalRef[QUEUE_KEY] = { queue, concurrency: targetConcurrency };
                return queue;
        }

        return existing.queue;
}
