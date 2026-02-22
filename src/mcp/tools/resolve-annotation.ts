import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult, ErrorResult } from '../types.js';

export async function resolveAnnotationHandler(
  storage: ReviewStorage,
  params: { id: string },
): Promise<ToolResult | ErrorResult> {
  try {
    const store = await storage.mutate(s => {
      const annotation = s.annotations.find(a => a.id === params.id);
      if (!annotation) {
        throw new Error(`Annotation with ID "${params.id}" not found`);
      }

      const now = new Date().toISOString();
      annotation.resolvedAt = now;
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
    'resolve_annotation',
    'Mark an annotation as resolved. Sets the resolvedAt timestamp to indicate the issue has been addressed. Can be called again to update the timestamp.',
    { id: z.string().min(1).describe('The annotation ID to mark as resolved') },
    async (params) => resolveAnnotationHandler(storage, params),
  );
}
