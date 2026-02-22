import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult } from './list-annotations.js';

interface ErrorResult extends ToolResult {
  isError: boolean;
}

export async function resolveAnnotationHandler(
  storage: ReviewStorage,
  params: { id: string },
): Promise<ToolResult | ErrorResult> {
  const store = await storage.read();
  const annotation = store.annotations.find(a => a.id === params.id);

  if (!annotation) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Annotation with ID "${params.id}" not found` }],
    };
  }

  const now = new Date().toISOString();
  annotation.resolvedAt = now;
  annotation.updatedAt = now;

  await storage.write(store);

  return {
    content: [{ type: 'text', text: JSON.stringify(annotation, null, 2) }],
  };
}

export function register(server: McpServer, storage: ReviewStorage): void {
  server.tool(
    'resolve_annotation',
    'Mark an annotation as resolved. Sets the resolvedAt timestamp to indicate the issue has been addressed. Can be called again to update the timestamp.',
    { id: z.string().describe('The annotation ID to mark as resolved') },
    async (params) => resolveAnnotationHandler(storage, params),
  );
}
