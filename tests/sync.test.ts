import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { login } from '@/commands/login';
import { status } from '@/commands/status';
import { sync } from '@/commands/sync';
import { runCli } from '@/program';
import { RECORD_RULES_VERSION } from '@/config';
import { configPath, loadConfig } from '@/store';
import { markFullUpload, syncStatePath } from '@/sync-state';
import { CLAUDE_SECRET } from './fixtures/claude';
import { testContext, type TestContext } from './helpers/context';
import { startFakeServer, type FakeServer } from './helpers/fake-server';
import { writeFixtureLogs } from './helpers/logs';
import { makeTempDir, removeDir } from './helpers/temp';

const UPLOAD_KEYS = ['cacheReadTokens', 'cacheWriteTokens', 'inputTokens', 'model', 'occurredAt', 'outputTokens', 'reasoningTokens', 'recordId', 'source'];

describe('login and sync against a fake API', () => {
  let root = '';
  let server: FakeServer;
  let ctx: TestContext;

  beforeEach(async () => {
    root = await makeTempDir('sync');
    server = await startFakeServer();
    const dirs = await writeFixtureLogs(root);
    ctx = testContext({
      home: root,
      env: {
        TOKENAIRES_API_URL: server.url,
        TOKENAIRES_WEB_URL: 'http://localhost:7021',
        XDG_CONFIG_HOME: join(root, 'xdg'),
        CLAUDE_CONFIG_DIR: dirs.claudeConfig,
        CODEX_HOME: dirs.codexHome,
      },
    });
  });
  afterEach(async () => {
    await server.close();
    await removeDir(root);
  });

  it('runs the device flow, honors slow_down and saves the config', async () => {
    server.state.pollReplies.push({ status: 'pending' }, { status: 'slow_down', interval: 4 });
    await login(ctx);
    expect(ctx.sleeps).toEqual([1000, 1000, 4000]);
    expect(ctx.opened).toEqual([expect.stringContaining('/approve?code=ABCD-EFGH')]);
    expect(ctx.lines.join('\n')).toContain('ABCD-EFGH');
    expect(server.state.pollBodies[0]).toEqual({ sessionId: 'sess-1', publicKey: server.state.publicKey, deviceName: 'test-host', platform: 'darwin' });
    const saved = await loadConfig(configPath(ctx.env, ctx.home));
    expect(saved).toMatchObject({ apiUrl: server.url, token: 'fake-token', deviceId: 'device-123', handle: 'ada' });
  });

  it('stops on a denied login without saving anything', async () => {
    server.state.pollReplies.push({ status: 'denied' });
    await expect(login(ctx)).rejects.toThrow('Login was denied');
    expect(await loadConfig(configPath(ctx.env, ctx.home))).toBeNull();
  });

  it('uploads signed batches with only the allowed fields and prints the result', async () => {
    await login(ctx);
    server.state.rateLimitOnce = true;
    const totals = await sync(ctx, { quiet: false });
    expect(server.state.badSignatures).toBe(0);
    expect(server.state.rateLimited).toBe(1);
    expect(ctx.sleeps).toContain(3000);
    expect(server.state.uploads).toHaveLength(1);
    const upload = server.state.uploads[0];
    expect(upload?.records).toHaveLength(7);
    for (const record of upload?.records ?? []) expect(Object.keys(record).sort()).toEqual(UPLOAD_KEYS);
    expect(upload?.raw).not.toContain(CLAUDE_SECRET);
    expect(totals).toMatchObject({ accepted: 6, duplicates: 1, acceptedTokens: 5000 });
    const output = ctx.lines.join('\n');
    expect(output).toMatch(/Accepted\s+6/);
    expect(output).toMatch(/Already synced\s+1/);
    expect(output).toMatch(/Signed in as @ada/);
    expect(output).toMatch(/Read \d+ log files .* tokens in 7 records/);
    expect(output).toMatch(/Uploaded 7 records/);
    expect(output).toMatch(/#42\s+#7\s+unranked/);
    expect(output).toMatch(/all time\s+this month\s+this week/);
    expect(output).toContain('http://localhost:7021/u/ada');
  });

  it('sends every record once after the record rules change, then only new ones', async () => {
    await login(ctx);
    server.state.cursors = [
      { source: 'claude-code', lastOccurredAt: '2026-10-05T00:00:00.000Z' },
      { source: 'codex', lastOccurredAt: '2026-10-01T10:00:00.000Z' },
    ];
    await sync(ctx, { quiet: true });
    expect(server.state.uploads.flatMap((upload) => upload.records)).toHaveLength(7);
    const state = JSON.parse(await readFile(syncStatePath(ctx.env, ctx.home), 'utf8')) as Record<string, unknown>;
    expect(state).toEqual({ handle: 'ada', rulesVersion: RECORD_RULES_VERSION });
    server.state.uploads.length = 0;
    await sync(ctx, { quiet: true });
    expect(server.state.uploads.flatMap((upload) => upload.records)).toHaveLength(5);
  });

  it('only sends records newer than the server cursor minus 48 hours', async () => {
    await login(ctx);
    await markFullUpload(syncStatePath(ctx.env, ctx.home), 'ada');
    server.state.cursors = [
      { source: 'claude-code', lastOccurredAt: '2026-10-05T00:00:00.000Z' },
      { source: 'codex', lastOccurredAt: '2026-10-01T10:00:00.000Z' },
    ];
    ctx.lines.length = 0;
    await sync(ctx, { quiet: true });
    const sent = server.state.uploads.flatMap((upload) => upload.records.map((record) => record.recordId));
    expect(sent).toHaveLength(5);
    expect(sent).toContain('msg_011CCCCCCCCCCCCCCCCCCCCC:req_011CCCCCCCCCCCCCCCCCCCCC');
    expect(sent).not.toContain('msg_011AAAAAAAAAAAAAAAAAAAAA:req_011AAAAAAAAAAAAAAAAAAAAA');
    expect(ctx.lines).toEqual([]);
  });

  it('tells the user to log in again on 401', async () => {
    await login(ctx);
    server.state.rejectAuth = true;
    const code = await runCli(ctx, ['sync']);
    expect(code).toBe(1);
    expect(ctx.errors.join('\n')).toContain('Run tokenaires login again.');
  });

  it('shows status with tier progress', async () => {
    await login(ctx);
    await status(ctx);
    const output = ctx.lines.join('\n');
    expect(output).toContain('Logged in as @ada');
    expect(output).toMatch(/#42\s+#7\s+unranked/);
    expect(output).toMatch(/all time\s+this month\s+this week/);
    expect(output).toMatch(/more tokens \S+ Thousandaire/);
  });

  it('logs in then syncs when run with no arguments, and scan works offline', async () => {
    expect(await runCli(ctx, [])).toBe(0);
    expect(server.state.uploads).toHaveLength(1);
    const uploadsBefore = server.state.uploads.length;
    await server.close();
    expect(await runCli(ctx, ['scan'])).toBe(0);
    expect(await runCli(ctx, ['--dry-run'])).toBe(0);
    expect(server.state.uploads).toHaveLength(uploadsBefore);
    expect(ctx.lines.join('\n')).toContain('nothing was uploaded');
    server = await startFakeServer();
  });

  it('revokes the device on the server when logging out', async () => {
    await login(ctx);
    expect(await runCli(ctx, ['logout'])).toBe(0);
    expect(server.state.revoked).toBe(1);
    expect(await loadConfig(configPath(ctx.env, ctx.home))).toBeNull();
    expect(ctx.lines.join('\n')).toContain("Logged out. This device's key was removed.");
    expect(ctx.lines.join('\n')).not.toContain('could not be reached');
  });

  it('still removes the local login when the server is unreachable', async () => {
    await login(ctx);
    await server.close();
    expect(await runCli(ctx, ['logout'])).toBe(0);
    expect(await loadConfig(configPath(ctx.env, ctx.home))).toBeNull();
    expect(ctx.lines.join('\n')).toContain('the server still accepts this device token');
    server = await startFakeServer();
  });

  it('signs uploads with server time when the computer clock is an hour off', async () => {
    await login(ctx);
    const skewed = testContext({ ...ctx, now: () => Date.now() + 60 * 60 * 1000 });
    const totals = await sync(skewed, { quiet: true });
    expect(server.state.staleSignatures).toBe(0);
    expect(server.state.badSignatures).toBe(0);
    expect(totals.accepted).toBeGreaterThan(0);
  });

  it('explains a clock problem instead of asking for a new login', async () => {
    await login(ctx);
    const withoutDate: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      const headers = new Headers(response.headers);
      headers.delete('date');
      return new Response(await response.text(), { status: response.status, headers });
    };
    const skewed = testContext({ ...ctx, fetch: withoutDate, now: () => Date.now() + 60 * 60 * 1000 });
    expect(await runCli(skewed, ['sync'])).toBe(1);
    const error = ctx.errors.join('\n');
    expect(error).toContain('Upload signature has expired. Check your clock');
    expect(error).toContain('turn on automatic date, time and time zone');
    expect(error).not.toContain('Run tokenaires login again');
  });

  it('ignores cursors for agent sources this CLI version does not know', async () => {
    await login(ctx);
    server.state.cursors = [
      { source: 'claude-code', lastOccurredAt: '2026-11-01T00:00:00Z' },
      { source: 'future-agent' as unknown as 'claude-code', lastOccurredAt: '2026-11-02T00:00:00Z' },
    ];
    expect(await runCli(ctx, ['sync', '--quiet'])).toBe(0);
  });

  it('fails validation when a known cursor has an invalid timestamp', async () => {
    await login(ctx);
    server.state.cursors = [
      { source: 'claude-code', lastOccurredAt: 'not-a-date' },
    ];
    expect(await runCli(ctx, ['sync', '--quiet'])).toBe(1);
    expect(ctx.errors.join('\n')).toContain('Tokenaires sent a response this version does not understand');
  });

  it('says so when sync runs without a login', async () => {
    expect(await runCli(ctx, ['sync'])).toBe(1);
    expect(ctx.errors.join('\n')).toContain('You are not logged in. Run tokenaires login first.');
    expect(await runCli(ctx, ['status'])).toBe(0);
    expect(ctx.lines.join('\n')).toContain('Not logged in.');
  });
});
