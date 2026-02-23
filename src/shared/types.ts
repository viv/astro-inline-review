/** Persisted store shape — source of truth in inline-review.json */
export interface ReviewStore {
  version: 1;
  annotations: Annotation[];
  pageNotes: PageNote[];
}

/** A reply added by a coding agent via MCP */
export interface AgentReply {
  message: string;
  createdAt: string;
}

/** Annotation lifecycle status */
export type AnnotationStatus = 'open' | 'addressed' | 'resolved';

/** Shared fields for all annotation types */
export interface BaseAnnotation {
  id: string;
  type: 'text' | 'element';
  pageUrl: string;
  pageTitle: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  status?: AnnotationStatus;
  addressedAt?: string;
  resolvedAt?: string;
  replies?: AgentReply[];
}

/**
 * Get the effective status of an annotation.
 * Handles backward compatibility: annotations without a status field
 * default to 'resolved' if resolvedAt is set, otherwise 'open'.
 */
export function getAnnotationStatus(a: BaseAnnotation): AnnotationStatus {
  if (a.status) return a.status;
  if (a.resolvedAt) return 'resolved';
  return 'open';
}

/** A text selection annotation */
export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  selectedText: string;
  range: SerializedRange;
  replacedText?: string;
}

/** Describes how to locate an annotated element */
export interface ElementSelector {
  cssSelector: string;
  xpath: string;
  description: string;
  tagName: string;
  attributes: Record<string, string>;
  outerHtmlPreview: string;
}

/** An element annotation (Alt+click) */
export interface ElementAnnotation extends BaseAnnotation {
  type: 'element';
  elementSelector: ElementSelector;
}

/** Discriminated union — all annotation types */
export type Annotation = TextAnnotation | ElementAnnotation;

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

export function createEmptyStore(): ReviewStore {
  return { version: 1, annotations: [], pageNotes: [] };
}

/** Type guard for text annotations */
export function isTextAnnotation(a: Annotation): a is TextAnnotation {
  return a.type === 'text';
}

/** Type guard for element annotations */
export function isElementAnnotation(a: Annotation): a is ElementAnnotation {
  return a.type === 'element';
}
