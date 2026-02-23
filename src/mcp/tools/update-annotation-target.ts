import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult, ErrorResult } from '../types.js';
import { isTextAnnotation } from '../../shared/types.js';

export async function updateAnnotationTargetHandler(
  storage: ReviewStorage,
  params: { id: string; replacedText: string },
): Promise<ToolResult | ErrorResult> {
  if (!params.replacedText.trim()) {
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

      if (!isTextAnnotation(annotation)) {
        throw new Error(`Annotation "${params.id}" is not a text annotation — replacedText only applies to text annotations`);
      }

      const now = new Date().toISOString();
      annotation.replacedText = params.replacedText;
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
    'update_annotation_target',
    'Update what text replaced the original annotated text. Call this after making changes so the annotation can be re-located on the page. Only applicable to text annotations.',
    {
      id: z.string().min(1).describe('The annotation ID to update'),
      replacedText: z.string().describe('The new text that replaced the original selected text'),
    },
    async (params) => updateAnnotationTargetHandler(storage, params),
  );
}
