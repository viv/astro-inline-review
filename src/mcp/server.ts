import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ReviewStorage } from '../server/storage.js';
import { register as registerListAnnotations } from './tools/list-annotations.js';
import { register as registerListPageNotes } from './tools/list-page-notes.js';
import { register as registerGetAnnotation } from './tools/get-annotation.js';
import { register as registerGetExport } from './tools/get-export.js';
import { register as registerAddressAnnotation } from './tools/address-annotation.js';
import { register as registerAddAgentReply } from './tools/add-agent-reply.js';
import { register as registerUpdateAnnotationTarget } from './tools/update-annotation-target.js';
import { register as registerSetInProgress } from './tools/set-in-progress.js';

export function parseStoragePath(argv: string[]): string {
  const idx = argv.indexOf('--storage');
  const value = idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
  const raw = value ?? './inline-review.json';
  return resolve(process.cwd(), raw);
}

async function main() {
  const storagePath = parseStoragePath(process.argv);
  const storage = new ReviewStorage(storagePath);

  const server = new McpServer({
    name: 'astro-inline-review-mcp',
    version: '0.1.0',
  });

  registerListAnnotations(server, storage);
  registerListPageNotes(server, storage);
  registerGetAnnotation(server, storage);
  registerGetExport(server, storage);
  registerAddressAnnotation(server, storage);
  registerAddAgentReply(server, storage);
  registerUpdateAnnotationTarget(server, storage);
  registerSetInProgress(server, storage);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
