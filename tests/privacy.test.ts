import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { batchBodies, prepareRecords, toUploadRecord, UPLOAD_FIELDS } from '@/payload';
import { scanLocal } from '@/scan';
import { CLAUDE_CWD, CLAUDE_SECRET } from './fixtures/claude';
import { DSH_SECRET } from './fixtures/deepseek-harness';
import { ANTIGRAVITY_SECRET } from './fixtures/antigravity';
import { CODEX_SECRET } from './fixtures/codex';
import { GEMINI_SECRET } from './fixtures/gemini';
import { OPENCODE_SECRET } from './fixtures/opencode';
import { writeAllSourceFixtures } from './helpers/all-sources';
import { writeFixtureLogs } from './helpers/logs';
import { makeTempDir, removeDir } from './helpers/temp';

const EXPECTED_KEYS = [
  'cacheReadTokens',
  'cacheWriteTokens',
  'inputTokens',
  'model',
  'occurredAt',
  'outputTokens',
  'reasoningTokens',
  'recordId',
  'source',
];

describe('upload payload privacy', () => {
  let root = '';
  let bodies: string[] = [];

  beforeAll(async () => {
    root = await makeTempDir('privacy');
    const dirs = await writeFixtureLogs(root);
    const scanned = await scanLocal({ env: { CLAUDE_CONFIG_DIR: dirs.claudeConfig, CODEX_HOME: dirs.codexHome }, home: root, cachePath: null });
    bodies = batchBodies(prepareRecords(scanned.records).valid);
  });
  afterAll(async () => {
    await removeDir(root);
  });

  it('serializes exactly the nine allowed fields per record', () => {
    expect(bodies).toHaveLength(1);
    const parsed: unknown = JSON.parse(bodies[0] ?? '');
    expect(parsed).toBeTypeOf('object');
    const batch = parsed as { cliVersion: unknown; records: Record<string, unknown>[] };
    expect(Object.keys(batch).sort()).toEqual(['cliVersion', 'records']);
    expect(batch.records).toHaveLength(7);
    for (const record of batch.records) expect(Object.keys(record).sort()).toEqual(EXPECTED_KEYS);
    expect([...UPLOAD_FIELDS].sort()).toEqual(EXPECTED_KEYS);
  });

  it('never includes prompts, paths, branches or project names', () => {
    const body = bodies.join('\n');
    for (const secret of [CLAUDE_SECRET, CODEX_SECRET, CLAUDE_CWD, 'secret-project', 'secret-branch', 'codex-secret', '/Users/']) {
      expect(body).not.toContain(secret);
    }
  });

  it('drops extra properties even when a record object carries them', () => {
    const tainted = {
      source: 'codex' as const,
      recordId: 'session-1234:1',
      model: 'gpt-test',
      occurredAt: '2026-10-01T10:00:00.000Z',
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      cwd: '/Users/someone',
      prompt: 'hello',
    };
    expect(Object.keys(toUploadRecord(tainted)).sort()).toEqual(EXPECTED_KEYS);
  });
});

describe('upload payload privacy across every source', () => {
  let root = '';
  let records: Record<string, unknown>[] = [];
  let body = '';

  beforeAll(async () => {
    root = await makeTempDir('privacy-all');
    const dirs = await writeAllSourceFixtures(root);
    const scanned = await scanLocal({ env: { CLAUDE_CONFIG_DIR: dirs.claudeConfig, CODEX_HOME: dirs.codexHome }, home: root, cachePath: null });
    const bodies = batchBodies(prepareRecords(scanned.records).valid);
    body = bodies.join('\n');
    records = bodies.flatMap((text) => (JSON.parse(text) as { records: Record<string, unknown>[] }).records);
  });
  afterAll(async () => {
    await removeDir(root);
  });

  it('includes valid records from the new sources with only the nine fields', () => {
    const sources = new Set(records.map((record) => record.source));
    expect([...sources].sort()).toEqual(['antigravity', 'claude-code', 'codex', 'deepseek-harness', 'gemini-cli', 'opencode']);
    for (const record of records) expect(Object.keys(record).sort()).toEqual(EXPECTED_KEYS);
    for (const record of records.filter((item) => item.source !== 'claude-code' && item.source !== 'codex')) {
      expect(record.recordId).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,159}$/);
    }
  });

  it('never includes prompts, project hashes, titles or paths from the new sources', () => {
    for (const secret of [GEMINI_SECRET, ANTIGRAVITY_SECRET, OPENCODE_SECRET, DSH_SECRET, 'secret-project-hash', 'secret title', 'secret step payload', 'opencode-secret', 'ses_secretsession01', '/Users/']) {
      expect(body).not.toContain(secret);
    }
  });
});
