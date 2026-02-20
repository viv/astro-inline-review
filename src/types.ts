/** Persisted store shape — source of truth in inline-review.json */
export interface ReviewStore {
  version: 1;
  annotations: Annotation[];
  pageNotes: PageNote[];
}

export interface Annotation {
  id: string;
  pageUrl: string;
  pageTitle: string;
  selectedText: string;
  note: string;
  range: SerializedRange;
  createdAt: string;
  updatedAt: string;
}

export interface PageNote {
  id: string;
  pageUrl: string;
  pageTitle: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedRange {
  startXPath: string;
  startOffset: number;
  endXPath: string;
  endOffset: number;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
}

/** Options accepted by the integration factory */
export interface InlineReviewOptions {
  /** Path to the JSON storage file (default: 'inline-review.json' in project root) */
  storagePath?: string;
}

export function createEmptyStore(): ReviewStore {
  return { version: 1, annotations: [], pageNotes: [] };
}
