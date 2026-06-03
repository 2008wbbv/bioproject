/**
 * Drive the comparison pipeline over a list of IDs and save each success to the
 * workspace (SPEC §10). Reports progress per item so the UI can render a live table.
 */
import { runComparison } from "../api/pipeline.ts";
import type { PipelineResult } from "../api/pipeline.ts";
import { ApiError } from "../api/errors.ts";
import { mapWithConcurrency } from "./pool.ts";
import type { WorkspaceEntry } from "../workspace/types.ts";

export type BatchItemStatus = "pending" | "running" | "done" | "error";

export interface BatchItem {
  query: string;
  status: BatchItemStatus;
  entry?: WorkspaceEntry;
  error?: string;
}

export const DEFAULT_CONCURRENCY = 4;

/** A save function (the workspace's saveResult), injected to keep this testable. */
export type SaveFn = (query: string, data: PipelineResult) => Promise<WorkspaceEntry>;

export async function runBatch(
  queries: string[],
  save: SaveFn,
  onUpdate: (items: BatchItem[]) => void,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<BatchItem[]> {
  const items: BatchItem[] = queries.map((query) => ({ query, status: "pending" }));
  const emit = () => onUpdate([...items]);
  emit();

  await mapWithConcurrency(
    queries,
    concurrency,
    async (query, index) => {
      items[index].status = "running";
      emit();
      const data = await runComparison(query);
      const entry = await save(query, data);
      items[index] = { query, status: "done", entry };
      emit();
      return entry;
    },
    (result) => {
      if (!result.ok) {
        const e = result.error;
        items[result.index] = {
          query: queries[result.index],
          status: "error",
          error: e instanceof ApiError ? `${e.source}: ${e.message}` : (e as Error)?.message ?? "failed",
        };
        emit();
      }
    },
  );

  return items;
}
