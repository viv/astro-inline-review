/** Client-side types — mirrors server types but used independently */

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

export interface ReviewStore {
  version: 1;
  annotations: Annotation[];
  pageNotes: PageNote[];
}
