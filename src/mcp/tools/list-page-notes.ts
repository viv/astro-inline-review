import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult } from './list-annotations.js';

export async function listPageNotesHandler(
  storage: ReviewStorage,
  params: { pageUrl?: string },
): Promise<ToolResult> {
  const store = await storage.read();
  const filtered = params.pageUrl
    ? store.pageNotes.filter(n => n.pageUrl === params.pageUrl)
    : store.pageNotes;

  return {
    content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
  };
}

export function register(server: McpServer, storage: ReviewStorage): void {
  server.tool(
    'list_page_notes',
    'List all page-level notes. Page notes are general comments about a page, not tied to specific text or elements. Optionally filter by page URL.',
    { pageUrl: z.string().optional().describe('Filter page notes by page URL path (e.g. "/about")') },
    async (params) => listPageNotesHandler(storage, params),
  );
}
