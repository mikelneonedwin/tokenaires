import { zstdCompressSync } from 'node:zlib';

export const DSH_SECRET = 'deepseek-harness-secret-prompt';
export const DSH_SESSION_ID = 'session-2c78dd9c-1095-4b96-9cd1-ee3dad5c7253';

export interface HarnessUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export function harnessSessionEvent(id = DSH_SESSION_ID): Record<string, unknown> {
  return {
    type: 'session',
    version: 4,
    id,
    createdAt: 1_793_913_365_855,
    cwd: '/Users/someone/secret-project',
    isSeeded: false,
    delegationDepth: 0,
    agentPreset: 'standard',
  };
}

export function harnessMessageEvent(options: {
  id: string;
  model?: string;
  time: number;
  usage?: Partial<HarnessUsage>;
  text?: string;
}): Record<string, unknown> {
  return {
    type: 'assistant/message',
    seq: 25,
    time: options.time,
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'thinking about the secret project' },
          { type: 'text', text: options.text ?? DSH_SECRET },
        ],
        source: { kind: 'model', provider: 'deepseek-account', model: options.model ?? 'deepseek-flash' },
        id: options.id,
      },
      usage: {
        inputTokens: options.usage?.inputTokens ?? 0,
        outputTokens: options.usage?.outputTokens ?? 0,
        cacheReadTokens: options.usage?.cacheReadTokens ?? 0,
        cacheWriteTokens: options.usage?.cacheWriteTokens ?? 0,
        totalTokens: (options.usage?.inputTokens ?? 0) + (options.usage?.outputTokens ?? 0),
      },
    },
  };
}

/** One zstd frame per event, exactly like DeepSeek Harness appends them to its session log. */
export function harnessLogBuffer(events: readonly Record<string, unknown>[]): Buffer {
  return Buffer.concat(events.map((event) => zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`, 'utf8'))));
}
