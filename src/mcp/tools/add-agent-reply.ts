import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReviewStorage } from '../../server/storage.js';
import type { ToolResult, ErrorResult } from '../types.js';

export async function addAgentReplyHandler(
  storage: ReviewStorage,
  params: { id: string; message: string },
): Promise<ToolResult | ErrorResult> {
  if (!params.message.trim()) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Reply message must not be empty' }],
    };
  }

  try {
    const store = await storage.mutate(s => {
      const annotation = s.annotations.find(a => a.id === params.id);
      if (!annotation) {
        throw new Error(`Annotation with ID "${params.id}" not found`);
      }

      const now = new Date().toISOString();
      if (!annotation.replies) {
        annotation.replies = [];
      }
      annotation.replies.push({ message: params.message, createdAt: now, role: 'agent' });
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
    'add_agent_reply',
    'Add a reply to an annotation explaining what action was taken. Appends to the replies array so reviewers can see agent responses alongside their original notes.',
    {
      id: z.string().min(1).describe('The annotation ID to reply to'),
      message: z.string().describe('The reply message explaining what was done'),
    },
    async (params) => addAgentReplyHandler(storage, params),
  );
}
