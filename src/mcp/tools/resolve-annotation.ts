import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult, ErrorResult } from '../types.js';

export async function resolveAnnotationHandler(
  storage: ReviewStorage,
  params: { id: string; autoResolve?: boolean },
): Promise<ToolResult | ErrorResult> {
  try {
    const store = await storage.mutate(s => {
      const annotation = s.annotations.find(a => a.id === params.id);
      if (!annotation) {
        throw new Error(`Annotation with ID "${params.id}" not found`);
      }

      const now = new Date().toISOString();
      if (params.autoResolve) {
        annotation.status = 'resolved';
        annotation.resolvedAt = now;
        // Keep addressedAt — shows when the agent first acted
      } else {
        annotation.status = 'addressed';
        annotation.addressedAt = now;
        annotation.resolvedAt = undefined;
      }
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
    'Mark an annotation as addressed by the agent. By default sets status to "addressed" (human reviewer closes it later). Pass autoResolve: true to skip human review and mark directly as "resolved".',
    {
      id: z.string().min(1).describe('The annotation ID to mark as addressed'),
      autoResolve: z.boolean().optional().describe('If true, skip human review and mark directly as resolved'),
    },
    async (params) => resolveAnnotationHandler(storage, params),
  );
}
