import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult, ErrorResult } from '../types.js';
import { isTextAnnotation } from '../../shared/types.js';

export async function addressAnnotationHandler(
  storage: ReviewStorage,
  params: { id: string; replacedText?: string },
): Promise<ToolResult | ErrorResult> {
  if (params.replacedText !== undefined && !params.replacedText.trim()) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'replacedText must not be empty' }],
    };
  }

  try {
    const store = await storage.mutate(s => {
      const annotation = s.annotations.find(a => a.id === params.id);
      if (!annotation) {
        throw new Error(`Annotation with ID "${params.id}" not found`);
      }

      if (params.replacedText !== undefined) {
        if (!isTextAnnotation(annotation)) {
          throw new Error(`Annotation "${params.id}" is not a text annotation — replacedText only applies to text annotations`);
        }
        annotation.replacedText = params.replacedText;
      }

      const now = new Date().toISOString();
      annotation.status = 'addressed';
      annotation.addressedAt = now;
      annotation.updatedAt = now;
      return s;
    });

    const annotation = store.annotations.find(a => a.id === params.id);
    return {
      content: [{ type: 'text', text: JSON.stringify(annotation, null, 2) }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: (err as Error).message }],
    };
  }
}

export function register(server: McpServer, storage: ReviewStorage): void {
  server.tool(
    'address_annotation',
    'Mark an annotation as addressed by the agent. Sets status to "addressed" so the human reviewer can confirm the fix later. Optionally provide replacedText to record the new text that replaced the original — this enables the browser UI to re-locate the annotation after the text has changed.',
    {
      id: z.string().min(1).describe('The annotation ID to mark as addressed'),
      replacedText: z.string().optional().describe('The new text that replaced the original annotated text (text annotations only). Enables re-anchoring in the browser UI.'),
    },
    async (params) => addressAnnotationHandler(storage, params),
  );
}
