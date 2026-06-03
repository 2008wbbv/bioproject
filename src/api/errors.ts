/**
 * Typed errors for the API layer (SPEC §2). Every api call either returns typed
 * data or throws an ApiError carrying the source and (when relevant) HTTP status,
 * so the UI can show a precise, source-attributed message.
 */
export class ApiError extends Error {
  constructor(
    /** Which data source failed, e.g. "UniProt", "AlphaFold", "PDBe". */
    public readonly source: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when a protein/structure simply has no data (vs. a transport failure). */
export class NotFoundError extends ApiError {
  constructor(source: string, message: string) {
    super(source, message, 404);
    this.name = "NotFoundError";
  }
}
