/**
 * Run an async task over many items with bounded concurrency (SPEC §10 batch).
 *
 * The per-protein pipeline is network-bound (the engine compute is milliseconds), so
 * a main-thread promise pool parallelises the slow part — the fetches — without the
 * complexity of a Web Worker pool. Results preserve input order; failures are
 * captured per item rather than aborting the batch. (Workers remain a future
 * optimisation if the compute ever dominates; the engine is pure and worker-safe.)
 */
export interface PoolResult<T> {
  index: number;
  ok: boolean;
  value?: T;
  error?: Error;
}

export async function mapWithConcurrency<I, T>(
  items: I[],
  concurrency: number,
  task: (item: I, index: number) => Promise<T>,
  onSettled?: (result: PoolResult<T>) => void,
): Promise<PoolResult<T>[]> {
  const results: PoolResult<T>[] = new Array(items.length);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      let result: PoolResult<T>;
      try {
        result = { index, ok: true, value: await task(items[index], index) };
      } catch (e) {
        result = { index, ok: false, error: e as Error };
      }
      results[index] = result;
      onSettled?.(result);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
