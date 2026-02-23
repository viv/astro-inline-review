export {
  type ReviewStore,
  type BaseAnnotation,
  type TextAnnotation,
  type ElementSelector,
  type ElementAnnotation,
  type Annotation,
  type AnnotationStatus,
  type PageNote,
  type SerializedRange,
  createEmptyStore,
  isTextAnnotation,
  isElementAnnotation,
  getAnnotationStatus,
} from './shared/types.js';

/** Options accepted by the integration factory */
export interface InlineReviewOptions {
  /** Path to the JSON storage file (default: 'inline-review.json' in project root) */
  storagePath?: string;
}
