import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface DevinDbSession {
  id: string;
  model?: string;
}

export interface DevinDbMessage {
  sessionId: string;
  nodeId: number;
  role?: 'assistant' | 'user';
  messageId?: string;
  requestId?: string;
  generationModel?: string | null;
  createdAt?: string | null;
  nodeCreatedAt?: number;
  metrics?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    cacheReadTokens?: number | null;
    cacheCreationTokens?: number | null;
  } | null;
}

export async function createDevinDb(path: string, sessions: DevinDbSession[], messages: DevinDbMessage[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    working_directory TEXT NOT NULL,
    backend_type TEXT NOT NULL,
    model TEXT NOT NULL,
    agent_mode TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity_at INTEGER NOT NULL,
    title TEXT,
    main_chain_id INTEGER,
    shell_last_seen_index INTEGER DEFAULT 0,
    cogs_json TEXT,
    workspace_dirs TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    metadata TEXT
  )`);
  db.exec(`CREATE TABLE message_nodes (
    row_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    node_id INTEGER NOT NULL,
    parent_node_id INTEGER,
    chat_message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    metadata TEXT,
    UNIQUE(session_id, node_id)
  )`);
  const insertSession = db.prepare('INSERT INTO sessions (id, working_directory, backend_type, model, agent_mode, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const session of sessions) {
    insertSession.run(session.id, '/tmp/devin-secret', 'windsurf', session.model ?? '', 'accept-edits', 1_794_000_000, 1_794_000_100);
  }
  const insertMessage = db.prepare('INSERT INTO message_nodes (session_id, node_id, parent_node_id, chat_message, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  for (const message of messages) {
    const chat: Record<string, unknown> = { role: message.role ?? 'assistant' };
    if (message.messageId) chat.message_id = message.messageId;
    const metadata: Record<string, unknown> = {};
    if (message.requestId) metadata.request_id = message.requestId;
    if (message.generationModel !== undefined) metadata.generation_model = message.generationModel;
    if (message.createdAt !== undefined) metadata.created_at = message.createdAt;
    if (message.metrics) {
      metadata.metrics = {
        input_tokens: message.metrics.inputTokens ?? null,
        output_tokens: message.metrics.outputTokens ?? null,
        cache_read_tokens: message.metrics.cacheReadTokens ?? null,
        cache_creation_tokens: message.metrics.cacheCreationTokens ?? null,
      };
    }
    chat.metadata = metadata;
    insertMessage.run(message.sessionId, message.nodeId, message.nodeId - 1, JSON.stringify(chat), message.nodeCreatedAt ?? 1_794_000_000, null);
  }
  db.close();
}
