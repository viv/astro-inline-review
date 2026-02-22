import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult } from './list-annotations.js';
import { generateExport } from '../../shared/export.js';

export async function getExportHandler(
  storage: ReviewStorage,
): Promise<ToolResult> {
  const store = await storage.read();
  const markdown = generateExport(store);

  return {
    content: [{ type: 'text', text: markdown }],
  };
}

export function register(server: McpServer, storage: ReviewStorage): void {
  server.tool(
    'get_export',
    'Get a markdown export of all annotations and page notes, grouped by page URL. Useful for getting a complete overview of all review feedback.',
    {},
    async () => getExportHandler(storage),
  );
}
