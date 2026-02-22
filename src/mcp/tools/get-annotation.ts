import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult, ErrorResult } from '../types.js';

export async function getAnnotationHandler(
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

  return {
    content: [{ type: 'text', text: JSON.stringify(annotation, null, 2) }],
  };
}

export function register(server: McpServer, storage: ReviewStorage): void {
  server.tool(
    'get_annotation',
    'Get a single annotation by its ID. Returns the full annotation including type, page URL, note, and selector/range details.',
    { id: z.string().min(1).describe('The annotation ID to retrieve') },
    async (params) => getAnnotationHandler(storage, params),
  );
}
