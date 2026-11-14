import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeHarnessLog, parseDeepseekHarnessFile, readHarnessLog } from '@/parsers/deepseek-harness';
import { deepseekHarnessSource } from '@/sources/deepseek-harness';
import {
  DSH_SECRET,
  DSH_SESSION_ID,
  harnessLogBuffer,
  harnessMessageEvent,
  harnessSessionEvent,
} from './fixtures/deepseek-harness';
import { makeTempDir, removeDir } from './helpers/temp';

const T1 = Date.parse('2026-11-05T15:02:52.318Z');
const T2 = Date.parse('2026-11-05T16:10:00.000Z');

async function writeSessionLog(root: string, session: string, events: readonly Record<string, unknown>[]): Promise<string> {
  const dir = join(root, '.dsh', 'sessions', '--Users-someone-secret-project--', session);
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'session.v4.jsonl.zstd');
  await writeFile(path, harnessLogBuffer(events));
  return path;
}

describe('DeepSeek Harness parser', () => {
  it('reads one record per appended zstd frame', () => {
    const data = harnessLogBuffer([
      harnessSessionEvent(),
      harnessMessageEvent({ id: '1e706ed0-3b3b-4c9d-ac27-a322069a1ade', time: T1, usage: { inputTokens: 8273, outputTokens: 71, cacheReadTokens: 8576 } }),
      harnessMessageEvent({ id: '2f817fe1-4c4c-5d0e-bd38-b433170b2bef', time: T2, usage: { inputTokens: 1200, outputTokens: 90, cacheWriteTokens: 40 } }),
    ]);
    expect(readHarnessLog(data)).toEqual([
      {
        source: 'deepseek-harness',
        recordId: `${DSH_SESSION_ID}:1e706ed0-3b3b-4c9d-ac27-a322069a1ade`,
        model: 'deepseek-flash',
        occurredAt: '2026-11-05T15:02:52.318Z',
        inputTokens: 8273,
        outputTokens: 71,
        cacheReadTokens: 8576,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
      {
        source: 'deepseek-harness',
        recordId: `${DSH_SESSION_ID}:2f817fe1-4c4c-5d0e-bd38-b433170b2bef`,
        model: 'deepseek-flash',
        occurredAt: '2026-11-05T16:10:00.000Z',
        inputTokens: 1200,
        outputTokens: 90,
        cacheReadTokens: 0,
        cacheWriteTokens: 40,
        reasoningTokens: 0,
      },
    ]);
  });

  it('skips events and messages that carry no usage', () => {
    const noUsage = { type: 'assistant/message', time: T1, data: { message: { id: '3a9280f2-5d5d-6e1f-ce49-c544281c3cfa', source: { model: 'deepseek-flash' } } } };
    const data = harnessLogBuffer([
      harnessSessionEvent(),
      { type: 'turn/start', time: T1, data: { turn: 1 } },
      { type: 'tool/call', time: T1, data: { name: 'shell' } },
      noUsage,
      harnessMessageEvent({ id: '4ba39103-6e6e-7f2a-df5a-d655392d4d0b', time: T2, usage: { inputTokens: 10, outputTokens: 2 } }),
    ]);
    expect(readHarnessLog(data).map((record) => record.recordId)).toEqual([`${DSH_SESSION_ID}:4ba39103-6e6e-7f2a-df5a-d655392d4d0b`]);
  });

  it('keeps every complete frame when the trailing frame is torn', () => {
    const complete = harnessLogBuffer([
      harnessSessionEvent(),
      harnessMessageEvent({ id: '5cb40214-7f7f-8a3b-ef6b-e7664a3e5e1c', time: T1, usage: { inputTokens: 100, outputTokens: 10 } }),
    ]);
    const torn = harnessLogBuffer([
      harnessMessageEvent({ id: '6dc51325-8a8a-9b4c-fa7c-f8775b4f6f2d', time: T2, usage: { inputTokens: 200, outputTokens: 20 } }),
    ]);
    const records = readHarnessLog(Buffer.concat([complete, torn.subarray(0, torn.length - 6)]));
    expect(records.map((record) => record.recordId)).toEqual([`${DSH_SESSION_ID}:5cb40214-7f7f-8a3b-ef6b-e7664a3e5e1c`]);
  });

  it('reads a log written as plain JSON lines', () => {
    const data = Buffer.from(
      `${JSON.stringify(harnessSessionEvent())}\n${JSON.stringify(harnessMessageEvent({ id: '7ed62436-9b9b-ac5d-0b8d-09886c5a7a3e', time: T1, usage: { inputTokens: 40, outputTokens: 5 } }))}\n`,
    );
    expect(decodeHarnessLog(data)).toHaveLength(1);
    expect(readHarnessLog(data)).toHaveLength(1);
  });

  it('drops messages without a model, a time or a usable id', () => {
    const noModel = harnessMessageEvent({ id: '8fe73547-acac-bd6e-1c9e-1a997d6b8b4f', time: T1, usage: { inputTokens: 5, outputTokens: 1 } });
    const message = (noModel.data as { message: Record<string, unknown> }).message;
    delete message.source;
    const noTime: Record<string, unknown> = {
      type: 'assistant/message',
      data: {
        message: { id: '9af84658-bdbd-ce7f-2daf-2baa8e7c9c5a', source: { kind: 'model', provider: 'deepseek-account', model: 'deepseek-flash' } },
        usage: { inputTokens: 5, outputTokens: 1 },
      },
    };
    const data = harnessLogBuffer([
      harnessSessionEvent(),
      noModel,
      noTime,
      harnessMessageEvent({ id: 'not a valid record id', time: T2, usage: { inputTokens: 5, outputTokens: 1 } }),
    ]);
    expect(readHarnessLog(data)).toEqual([]);
  });

  it('falls back to the message id when the session header is missing', () => {
    const data = harnessLogBuffer([
      harnessMessageEvent({ id: '0ab95769-cece-df80-3eb0-3cbb9f8dad6b', time: T1, usage: { inputTokens: 7, outputTokens: 3 } }),
    ]);
    expect(readHarnessLog(data).map((record) => record.recordId)).toEqual(['0ab95769-cece-df80-3eb0-3cbb9f8dad6b']);
  });

  it('never carries prompts, working directories or session titles into records', () => {
    const data = harnessLogBuffer([
      harnessSessionEvent(),
      harnessMessageEvent({ id: '1bc0687a-dfdf-e091-4fc1-4dcca09ebe7c', time: T1, usage: { inputTokens: 11, outputTokens: 4 } }),
    ]);
    const serialized = JSON.stringify(readHarnessLog(data));
    for (const secret of [DSH_SECRET, 'secret-project', 'secret-project--', '/Users/someone']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('discovers session logs under the DeepSeek Harness data folder', async () => {
    const root = await makeTempDir('dsh');
    try {
      const path = await writeSessionLog(root, DSH_SESSION_ID, [harnessSessionEvent(), harnessMessageEvent({ id: '2cd1798b-e0e0-f1a2-5fd2-5edd0b1fcf8d', time: T1, usage: { inputTokens: 9, outputTokens: 2 } })]);
      await mkdir(join(root, '.dsh', 'sessions', '--x--', 'session-1'), { recursive: true });
      await writeFile(join(root, '.dsh', 'sessions', '--x--', 'session-1', 'notes.txt'), 'ignored');

      const discovered = await deepseekHarnessSource.discover({ home: root, env: {}, platform: 'linux' });
      expect(discovered).toEqual([path]);

      const custom = join(root, 'custom-dsh');
      await mkdir(join(custom, 'sessions', '--y--', 'session-2'), { recursive: true });
      const customPath = join(custom, 'sessions', '--y--', 'session-2', 'session.v4.jsonl.zstd');
      await writeFile(customPath, harnessLogBuffer([harnessMessageEvent({ id: '3de2809c-f1f1-a2b3-6fe3-6fee1c209d9e', time: T1, usage: { inputTokens: 3, outputTokens: 1 } })]));
      expect(await deepseekHarnessSource.discover({ home: root, env: { DSH_HOME: custom }, platform: 'linux' })).toEqual([customPath]);

      expect(await parseDeepseekHarnessFile(path)).toHaveLength(1);
    } finally {
      await removeDir(root);
    }
  });

  it('returns null for a log it cannot read', async () => {
    expect(await parseDeepseekHarnessFile(join(await makeTempDir('dsh'), 'missing.v4.jsonl.zstd'))).toBeNull();
  });
});
