/**
 * The single place the app talks to the network (SPEC §2: "No raw fetch in
 * components"). Thin wrappers around fetch that translate transport/HTTP failures
 * into typed ApiErrors. CORS was verified for every endpoint in Phase 0
 * (docs/PHASE0.md), so these run directly from the browser with no proxy.
 */
import { ApiError, NotFoundError } from "./errors.ts";

async function request(url: string, source: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    // Network error, DNS, offline, or (rarely) a CORS rejection.
    throw new ApiError(source, `Network request failed: ${(e as Error).message}`);
  }
  if (res.status === 404) {
    throw new NotFoundError(source, `Not found: ${url}`);
  }
  if (!res.ok) {
    throw new ApiError(source, `HTTP ${res.status} from ${source}`, res.status);
  }
  return res;
}

export async function fetchText(url: string, source: string): Promise<string> {
  return (await request(url, source)).text();
}

export async function fetchJson<T>(url: string, source: string): Promise<T> {
  const res = await request(url, source);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(source, `Invalid JSON from ${source}`);
  }
}

/**
 * Try several URLs in order, returning the first that succeeds. Used where a source
 * has flaky mirrors (RCSB's CDN, see Phase 0). Throws the LAST error if all fail.
 */
export async function fetchTextWithFallback(
  urls: Array<{ url: string; source: string }>,
): Promise<{ text: string; url: string; source: string }> {
  let lastErr: unknown;
  for (const { url, source } of urls) {
    try {
      return { text: await fetchText(url, source), url, source };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
