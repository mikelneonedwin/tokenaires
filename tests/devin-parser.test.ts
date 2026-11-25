import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devinDbRecordId, devinRecordId, parseDevinContent, parseDevinDb, parseDevinFile } from '@/parsers/devin';
import { devinSource } from '@/sources/devin';
import { makeDevinTranscript } from './fixtures/devin';
import { createDevinDb } from './helpers/devin-db';

describe('Devin parser', () => {
  it('parses ATIF trajectory and extracts usage records from agent steps', () => {
    const transcript = makeDevinTranscript({
      sessionId: 'test-session-001',
      steps: [
        {
          stepId: 1,
          source: 'system',
          timestamp: '2026-11-09T12:00:00.000Z',
        },
        {
          stepId: 2,
          source: 'user',
          timestamp: '2026-11-09T12:01:00.000Z',
        },
        {
          stepId: 3,
          source: 'agent',
          timestamp: '2026-11-09T12:02:00.000Z',
          generationModel: 'swe-2-flash-medium',
          metrics: {
            promptTokens: 15000,
            completionTokens: 250,
            cachedTokens: 8000,
          },
        },
        {
          stepId: 4,
          source: 'agent',
          timestamp: '2026-11-09T12:03:00.000Z',
          metrics: {
            promptTokens: 18000,
            completionTokens: 300,
            cachedTokens: 12000,
          },
        },
      ],
    });

    expect(parseDevinContent(transcript)).toEqual([
      {
        source: 'devin',
        recordId: devinRecordId('test-session-001', 3, '2026-11-09T12:02:00.000Z'),
        model: 'swe-2-flash-medium',
        occurredAt: '2026-11-09T12:02:00.000Z',
        inputTokens: 7000,
        outputTokens: 250,
        cacheReadTokens: 8000,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
      {
        source: 'devin',
        recordId: devinRecordId('test-session-001', 4, '2026-11-09T12:03:00.000Z'),
        model: 'swe-2-flash-medium',
        occurredAt: '2026-11-09T12:03:00.000Z',
        inputTokens: 6000,
        outputTokens: 300,
        cacheReadTokens: 12000,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    ]);
  });

  it('skips steps without completion tokens or without metrics', () => {
    const transcript = makeDevinTranscript({
      sessionId: 'session-zero-tokens',
      steps: [
        {
          stepId: 1,
          source: 'agent',
          timestamp: '2026-11-09T12:00:00.000Z',
          metrics: {
            promptTokens: 1000,
            completionTokens: 0,
          },
        },
        {
          stepId: 2,
          source: 'agent',
          timestamp: '2026-11-09T12:01:00.000Z',
        },
      ],
    });

    const records = parseDevinContent(transcript);
    expect(records).toEqual([]);
  });

  it('hashes record ids so short session names from different people never collide', () => {
    const at = '2026-11-09T12:00:00.000Z';
    const id = devinRecordId('tarry-sage', 9, at);
    expect(id).toMatch(/^devin:[0-9a-f]{32}$/);
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,159}$/);
    expect(devinRecordId('tarry-sage', 9, at)).toBe(id);
    expect(devinRecordId('tarry-sage', 9, '2026-11-10T08:00:00.000Z')).not.toBe(id);
    expect(devinRecordId('tarry-sage', 10, at)).not.toBe(id);
    expect(devinRecordId('', 1, at)).toBeNull();
    expect(devinRecordId('tarry-sage', '', at)).toBeNull();
  });

  it('keeps prompt tokens whole when the cached count does not fit inside them', () => {
    const records = parseDevinContent(
      makeDevinTranscript({
        sessionId: 'odd-cache',
        steps: [{ stepId: 1, source: 'agent', timestamp: '2026-11-09T12:00:00.000Z', metrics: { promptTokens: 100, completionTokens: 10, cachedTokens: 400 } }],
      }),
    );
    expect(records?.[0]).toMatchObject({ inputTokens: 100, cacheReadTokens: 0, outputTokens: 10 });
  });

  it('discovers transcript files and respects DEVIN_SESSIONS_DIR', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'devin-test-'));
    const transcriptsDir = join(dir, 'transcripts');
    await mkdir(transcriptsDir, { recursive: true });

    const sessionFile = join(transcriptsDir, 'session-abc.json');
    await writeFile(
      sessionFile,
      makeDevinTranscript({
        sessionId: 'session-abc',
        steps: [
          {
            stepId: 1,
            source: 'agent',
            timestamp: '2026-11-09T12:00:00.000Z',
            metrics: { promptTokens: 500, completionTokens: 50 },
          },
        ],
      }),
    );

    try {
      const discovered = await devinSource.discover({
        home: dir,
        env: { DEVIN_SESSIONS_DIR: dir },
        platform: 'linux',
      });
      expect(discovered).toContain(sessionFile);

      const parsed = await parseDevinFile(sessionFile);
      expect(parsed).toHaveLength(1);
      expect(parsed?.[0]?.recordId).toBe(devinRecordId('session-abc', 1, '2026-11-09T12:00:00.000Z'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns empty array or null for corrupted transcripts', () => {
    expect(parseDevinContent('not valid json')).toBeNull();
    expect(parseDevinContent('{}')).toBeNull();
    expect(parseDevinContent(JSON.stringify({ session_id: 'sess-1' }))).toEqual([]);
  });

  it('reads token metrics from sessions.db and dedupes message nodes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'devin-db-'));
    const dbPath = join(dir, 'sessions.db');
    try {
      await createDevinDb(
        dbPath,
        [{ id: 'sheer-toad', model: 'swe-1-6-slow' }],
        [
          {
            sessionId: 'sheer-toad',
            nodeId: 1,
            role: 'user',
            messageId: 'user-message',
            createdAt: '2026-11-14T21:00:00.000Z',
          },
          {
            sessionId: 'sheer-toad',
            nodeId: 2,
            messageId: '01914dfc-c90c-4c77-9d06-4b110fe752c7',
            requestId: '5a0f6239-7813-49a5-af16-39c33a175a8b',
            generationModel: 'swe-2-flash-medium',
            createdAt: '2026-11-14T21:27:45.907186900Z',
            metrics: { inputTokens: 701, outputTokens: 1059, cacheReadTokens: 111360, cacheCreationTokens: null },
          },
          {
            sessionId: 'sheer-toad',
            nodeId: 3,
            messageId: '01914dfc-c90c-4c77-9d06-4b110fe752c7',
            requestId: '5a0f6239-7813-49a5-af16-39c33a175a8b',
            generationModel: 'swe-2-flash-medium',
            createdAt: '2026-11-14T21:27:45.907186900Z',
            metrics: { inputTokens: 701, outputTokens: 1059, cacheReadTokens: 111360, cacheCreationTokens: null },
          },
          {
            sessionId: 'sheer-toad',
            nodeId: 4,
            messageId: 'fallback-model-message',
            createdAt: '2026-11-14T21:28:00.000Z',
            metrics: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 7 },
          },
          {
            sessionId: 'sheer-toad',
            nodeId: 5,
            messageId: 'no-metrics-message',
            generationModel: 'swe-2-flash-medium',
            createdAt: '2026-11-14T21:29:00.000Z',
          },
        ],
      );

      const records = await parseDevinDb(dbPath);
      expect(records).toHaveLength(2);
      expect(records?.[0]).toMatchObject({
        source: 'devin',
        recordId: devinDbRecordId('sheer-toad', '01914dfc-c90c-4c77-9d06-4b110fe752c7', '5a0f6239-7813-49a5-af16-39c33a175a8b', 2),
        model: 'swe-2-flash-medium',
        occurredAt: '2026-11-14T21:27:45.907Z',
        inputTokens: 701,
        outputTokens: 1059,
        cacheReadTokens: 111360,
        cacheWriteTokens: 0,
      });
      expect(records?.[1]).toMatchObject({ model: 'swe-1-6-slow', inputTokens: 10, outputTokens: 5, cacheWriteTokens: 7 });
      expect(records?.[0]?.recordId).toMatch(/^devin:[0-9a-f]{32}$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('discovers sessions.db through DEVIN_SESSIONS_DIR', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'devin-db-discover-'));
    const dbPath = join(dir, 'sessions.db');
    try {
      await createDevinDb(
        dbPath,
        [{ id: 'db-session' }],
        [
          {
            sessionId: 'db-session',
            nodeId: 1,
            messageId: 'db-message-id',
            generationModel: 'swe-2-flash-medium',
            createdAt: '2026-11-14T21:30:00.000Z',
            metrics: { inputTokens: 20, outputTokens: 8 },
          },
        ],
      );
      const discovered = await devinSource.discover({ home: dir, env: { DEVIN_SESSIONS_DIR: dir }, platform: 'linux' });
      expect(discovered).toContain(dbPath);
      const parsed = await parseDevinFile(dbPath);
      expect(parsed).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
