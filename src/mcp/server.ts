import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const server = new McpServer({
    name: 'astro-inline-review-mcp',
    version: '0.1.0',
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
