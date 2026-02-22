import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ReviewStorage } from '../server/storage.js';
import { register as registerListAnnotations } from './tools/list-annotations.js';
import { register as registerListPageNotes } from './tools/list-page-notes.js';
import { register as registerGetAnnotation } from './tools/get-annotation.js';
import { register as registerGetExport } from './tools/get-export.js';
import { register as registerResolveAnnotation } from './tools/resolve-annotation.js';
import { register as registerAddAgentReply } from './tools/add-agent-reply.js';

async function main() {
  const storage = new ReviewStorage('./inline-review.json');

  const server = new McpServer({
    name: 'astro-inline-review-mcp',
    version: '0.1.0',
  });

  registerListAnnotations(server, storage);
  registerListPageNotes(server, storage);
  registerGetAnnotation(server, storage);
  registerGetExport(server, storage);
  registerResolveAnnotation(server, storage);
  registerAddAgentReply(server, storage);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
