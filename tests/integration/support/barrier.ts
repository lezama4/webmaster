export interface Deferred<T = void> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

/** A promise whose resolution the test controls externally — the building block for barrier-based interleaving tests (tasks 4.10-4.17, 4.22). */
export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Yields to the event loop long enough for a concurrently-fired transaction to actually reach Postgres and block on `SELECT ... FOR UPDATE`, before the test releases the first transaction's hold on the lock. */
export function tick(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
