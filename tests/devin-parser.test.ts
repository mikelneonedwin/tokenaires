import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devinRecordId, parseDevinContent, parseDevinFile } from '@/parsers/devin';
import { devinSource } from '@/sources/devin';
import { makeDevinTranscript } from './fixtures/devin';

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
});
