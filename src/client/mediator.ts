/**
 * Typed mediator for cross-module communication.
 *
 * Replaces the untyped (shadowRoot as any).__xxx bridge pattern
 * with a discoverable, compile-time-safe contract.
 */
export interface ReviewMediator {
  refreshPanel: () => Promise<void>;
  restoreHighlights: () => Promise<void>;
}
