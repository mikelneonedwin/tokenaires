import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseVsCodeFile } from '@/parsers/vscode';
import { vscodeSource } from '@/sources/vscode';
import { makeVsCodeDb } from './fixtures/vscode';

describe('VS Code parser', () => {
  it('parses turn_usage and assistant_response_parts to extract usage records', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vscode-test-'));
    const sessionDir = join(dir, 'session-abc-123');
    await mkdir(sessionDir, { recursive: true });
    const dbPath = join(sessionDir, 'session.db');

    try {
      makeVsCodeDb(dbPath, [
        {
          turnId: 'request_turn-1',
          model: 'claude-3-5-sonnet',
          inputTokens: 1200,
          outputTokens: 300,
          cacheReadTokens: 400,
          cacheWriteTokens: 100,
          parts: [{ startedAt: 1726000000000, text: 'Hello' }],
        },
        {
          turnId: 'request_turn-2',
          model: 'gpt-4o',
          inputTokens: 500,
          outputTokens: 80,
          parts: [{ startedAt: 1726000100000 }],
        },
      ]);

      const records = await parseVsCodeFile(dbPath);
      expect(records).toEqual([
        {
          source: 'vscode',
          recordId: 'session-abc-123:request_turn-1',
          model: 'claude-3-5-sonnet',
          occurredAt: '2024-09-10T20:26:40.000Z',
          inputTokens: 1200,
          outputTokens: 300,
          cacheReadTokens: 400,
          cacheWriteTokens: 100,
          reasoningTokens: 0,
        },
        {
          source: 'vscode',
          recordId: 'session-abc-123:request_turn-2',
          model: 'gpt-4o',
          occurredAt: '2024-09-10T20:28:20.000Z',
          inputTokens: 500,
          outputTokens: 80,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
        },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('skips turns without models or without output tokens', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vscode-test-'));
    const sessionDir = join(dir, 'session-xyz');
    await mkdir(sessionDir, { recursive: true });
    const dbPath = join(sessionDir, 'session.db');

    try {
      makeVsCodeDb(dbPath, [
        {
          turnId: 'no-model',
          inputTokens: 500,
          outputTokens: 50,
        },
        {
          turnId: 'zero-output',
          model: 'gpt-4o',
          inputTokens: 500,
          outputTokens: 0,
        },
        {
          turnId: 'valid-turn',
          model: 'gpt-4o',
          inputTokens: 500,
          outputTokens: 50,
          parts: [{ startedAt: 1726000000000 }],
        },
      ]);

      const records = await parseVsCodeFile(dbPath);
      expect(records).toHaveLength(1);
      expect(records?.[0]?.recordId).toBe('session-xyz:valid-turn');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('drops records whose ids contain characters refused by the backend', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vscode-test-'));
    const sessionDir = join(dir, 'session with spaces');
    await mkdir(sessionDir, { recursive: true });
    const dbPath = join(sessionDir, 'session.db');

    try {
      makeVsCodeDb(dbPath, [
        {
          turnId: 'turn-1',
          model: 'gpt-4o',
          inputTokens: 100,
          outputTokens: 50,
          parts: [{ startedAt: 1726000000000 }],
        },
      ]);

      const records = await parseVsCodeFile(dbPath);
      expect(records).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns empty array when turn_usage table is missing and null on corrupt file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vscode-test-'));
    const sessionDir = join(dir, 'session-empty');
    await mkdir(sessionDir, { recursive: true });
    const emptyDbPath = join(sessionDir, 'empty.db');
    const corruptDbPath = join(sessionDir, 'corrupt.db');

    try {
      makeVsCodeDb(emptyDbPath, [], { createEmpty: true });
      const emptyRecords = await parseVsCodeFile(emptyDbPath);
      expect(emptyRecords).toEqual([]);

      const { writeFile } = await import('node:fs/promises');
      await writeFile(corruptDbPath, 'not a valid sqlite database');
      const corruptRecords = await parseVsCodeFile(corruptDbPath);
      expect(corruptRecords).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('discovers session.db files in standard candidate paths and honors VSCODE_DATA_DIR', async () => {
    const home = await mkdtemp(join(tmpdir(), 'vscode-home-'));
    const places = {
      darwin: join(home, 'Library', 'Application Support', 'Code', 'agentSessionData', 's1'),
      linux: join(home, '.config', 'Code', 'agentSessionData', 's2'),
      flatpak: join(home, '.var', 'app', 'com.visualstudio.code', 'config', 'Code', 'agentSessionData', 's3'),
      custom: join(home, 'custom-vscode', 'agentSessionData', 's4'),
    };

    for (const dir of Object.values(places)) {
      await mkdir(dir, { recursive: true });
      makeVsCodeDb(join(dir, 'session.db'), []);
    }

    try {
      const darwinDiscovered = await vscodeSource.discover({ home, env: {}, platform: 'darwin' });
      expect(darwinDiscovered).toContain(join(places.darwin, 'session.db'));

      const linuxDiscovered = await vscodeSource.discover({ home, env: {}, platform: 'linux' });
      expect(linuxDiscovered).toContain(join(places.linux, 'session.db'));
      expect(linuxDiscovered).toContain(join(places.flatpak, 'session.db'));

      const customDiscovered = await vscodeSource.discover({
        home,
        env: { VSCODE_DATA_DIR: join(home, 'custom-vscode') },
        platform: 'linux',
      });
      expect(customDiscovered).toContain(join(places.custom, 'session.db'));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
