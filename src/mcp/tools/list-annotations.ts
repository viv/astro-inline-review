import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult } from '../types.js';

export async function listAnnotationsHandler(
  storage: ReviewStorage,
  params: { pageUrl?: string },
): Promise<ToolResult> {
  const store = await storage.read();
  const filtered = params.pageUrl
    ? store.annotations.filter(a => a.pageUrl === params.pageUrl)
    : store.annotations;

  return {
    content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
  };
}

export function register(server: McpServer, storage: ReviewStorage): void {
  server.tool(
    'list_annotations',
    'List all review annotations. Returns text and element annotations with their notes, selectors, and page context. Optionally filter by page URL.',
    { pageUrl: z.string().optional().describe('Filter annotations by page URL path (e.g. "/about")') },
    async (params) => listAnnotationsHandler(storage, params),
  );
}
