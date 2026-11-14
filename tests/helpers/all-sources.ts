import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ANTIGRAVITY_CASCADE, generation } from '../fixtures/antigravity';
import { DSH_SESSION_ID, harnessLogBuffer, harnessMessageEvent, harnessSessionEvent } from '../fixtures/deepseek-harness';
import { geminiSession } from '../fixtures/gemini';
import { legacyAssistant, legacyUser, tokens, v2Assistant } from '../fixtures/opencode';
import { createConversation } from './antigravity-db';
import { writeFixtureLogs, type LogDirs } from './logs';
import { createOpenCodeDb } from './opencode-db';
import { writeLines } from './temp';

const T = 1_790_000_000_000;

export async function writeAllSourceFixtures(root: string): Promise<LogDirs> {
  const dirs = await writeFixtureLogs(root);
  await writeLines(join(root, '.gemini', 'tmp', 'secret-project-hash', 'chats', 'session-2026-10-05T08-00-0f1e2d3c.jsonl'), geminiSession);
  const conversation = join(root, '.gemini', 'antigravity', 'conversations', `${ANTIGRAVITY_CASCADE}.db`);
  const generations = [generation({ responseId: 'resp-ag-0001', model: 'Gemini Test Pro', createdAt: '2026-10-06T09:00:00.000Z', usage: { input: 9, output: 3 } })];
  (await createConversation(conversation, { generations })).close();
  await createOpenCodeDb(
    join(root, '.local', 'share', 'opencode', 'opencode.db'),
    [
      { id: 'msg_user000000000001', created: T, data: legacyUser },
      { id: 'msg_newschema0000001', created: T + 1, data: legacyAssistant('msg_newschema0000001', T + 1, tokens(100, 50, 20, 1000, 10, 1180)) },
    ],
    [{ id: 'msg_v2assistant00005', type: 'assistant', created: T + 5, data: v2Assistant(T + 5, tokens(300, 40, 25, 2000, 0)) }],
  );
  const dshDir = join(root, '.dsh', 'sessions', '--Users-someone-secret-project--', DSH_SESSION_ID);
  await mkdir(dshDir, { recursive: true });
  await writeFile(
    join(dshDir, 'session.v4.jsonl.zstd'),
    harnessLogBuffer([
      harnessSessionEvent(),
      harnessMessageEvent({ id: 'af1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', time: T + 9, usage: { inputTokens: 120, outputTokens: 30, cacheReadTokens: 900 } }),
    ]),
  );
  return dirs;
}
