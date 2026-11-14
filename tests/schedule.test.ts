import { access, readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { schedule } from '@/commands/schedule';
import { runCli } from '@/program';
import { parseHours, plistPath } from '@/schedule/launchd';
import { testContext } from './helpers/context';
import { makeTempDir, removeDir } from './helpers/temp';

describe('schedule', () => {
  let home = '';
  beforeEach(async () => {
    home = await makeTempDir('home');
  });
  afterEach(async () => {
    await removeDir(home);
  });

  it('writes a LaunchAgent under the temp HOME and loads it through the injected runner', async () => {
    const ctx = testContext({ home, env: { XDG_CONFIG_HOME: '/tmp/xdg & co' } });
    await schedule(ctx, 'on');
    const path = plistPath(home);
    expect(path.startsWith(home)).toBe(true);
    const plist = await readFile(path, 'utf8');
    expect(plist).toContain('<string>com.tokenaires.sync</string>');
    expect(plist).toContain('<integer>21600</integer>');
    expect(plist).toContain('<string>/usr/local/bin/node</string>');
    expect(plist).toContain('<string>/opt/tokenaires/dist/cli.js</string>');
    expect(plist).toContain('<string>sync</string>');
    expect(plist).toContain('<string>--quiet</string>');
    expect(plist).toContain('<string>/tmp/xdg &amp; co</string>');
    expect(ctx.commands).toEqual([
      { command: 'launchctl', args: ['unload', path] },
      { command: 'launchctl', args: ['load', '-w', path] },
    ]);
  });

  it('syncs at a chosen interval and says so', async () => {
    const ctx = testContext({ home, env: {} });
    expect(await runCli(ctx, ['schedule', 'on', '--every', '2h'])).toBe(0);
    expect(await readFile(plistPath(home), 'utf8')).toContain('<integer>7200</integer>');
    expect(ctx.lines.join('\n')).toContain('Tokenaires will sync every 2 hours.');
  });

  it('refuses intervals shorter than 2 hours or longer than a day', async () => {
    for (const value of ['1', '1h', '30m', '25h', '2.5', 'soon']) {
      const ctx = testContext({ home, env: {} });
      expect(await runCli(ctx, ['schedule', 'on', '--every', value])).toBe(1);
      expect(ctx.errors.join('\n')).toContain('Use whole hours from 2 to 24');
      expect(ctx.commands).toEqual([]);
    }
    await expect(access(plistPath(home))).rejects.toThrow();
  });

  it('reads hours, hour words and one day', () => {
    expect(parseHours('2')).toBe(2);
    expect(parseHours('12h')).toBe(12);
    expect(parseHours('8 hours')).toBe(8);
    expect(parseHours('1d')).toBe(24);
    expect(parseHours('24h')).toBe(24);
    expect(parseHours('1h')).toBeNull();
    expect(parseHours('2d')).toBeNull();
  });

  it('unloads and removes the LaunchAgent when turned off', async () => {
    const ctx = testContext({ home, env: {} });
    await schedule(ctx, 'on');
    await schedule(ctx, 'off');
    await expect(access(plistPath(home))).rejects.toThrow();
    expect(ctx.commands.at(-1)).toEqual({ command: 'launchctl', args: ['unload', '-w', plistPath(home)] });
    expect(ctx.lines.join('\n')).toContain('Schedule removed.');
  });

  it('reports a launchctl failure', async () => {
    const ctx = testContext({
      home,
      env: {},
      run: (_command, args) => Promise.resolve({ code: args[0] === 'load' ? 5 : 0, stdout: '', stderr: 'denied' }),
    });
    await expect(schedule(ctx, 'on')).rejects.toThrow('launchctl could not load the schedule: denied');
  });

  it('prints a crontab line on Linux without touching the system', async () => {
    const ctx = testContext({ home, env: {}, platform: 'linux' });
    await schedule(ctx, 'on');
    expect(ctx.commands).toEqual([]);
    expect(ctx.lines.join('\n')).toContain('0 */6 * * * /usr/local/bin/node /opt/tokenaires/dist/cli.js sync --quiet');
    const daily = testContext({ home, env: {}, platform: 'linux' });
    await schedule(daily, 'on', { hours: 24 });
    expect(daily.lines.join('\n')).toContain('sync every day:');
    expect(daily.lines.join('\n')).toContain('0 0 * * * /usr/local/bin/node');
    const every3 = testContext({ home, env: {}, platform: 'linux' });
    await schedule(every3, 'on', { hours: 3 });
    expect(every3.lines.join('\n')).toContain('0 */3 * * * /usr/local/bin/node');
  });

  it('creates a scheduled task on Windows with schtasks', async () => {
    const ctx = testContext({
      home,
      env: {},
      platform: 'win32',
      nodePath: 'C:\\Program Files\\nodejs\\node.exe',
      scriptPath: 'C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\tokenaires\\dist\\cli.js',
    });
    await schedule(ctx, 'on');
    expect(ctx.commands).toEqual([
      {
        command: 'schtasks',
        args: [
          '/create',
          '/tn',
          'com.tokenaires.sync',
          '/tr',
          '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\tokenaires\\dist\\cli.js" sync --quiet',
          '/sc',
          'HOURLY',
          '/mo',
          '6',
          '/f',
        ],
      },
    ]);
    expect(ctx.lines.join('\n')).toContain('Tokenaires will sync every 6 hours.');
    expect(ctx.lines.join('\n')).toContain('Task name: com.tokenaires.sync');
  });

  it('schedules daily on Windows when hours is 24', async () => {
    const ctx = testContext({
      home,
      env: {},
      platform: 'win32',
      nodePath: 'C:\\node.exe',
      scriptPath: 'C:\\tokenaires\\dist\\cli.js',
    });
    await schedule(ctx, 'on', { hours: 24 });
    expect(ctx.commands).toEqual([
      {
        command: 'schtasks',
        args: [
          '/create',
          '/tn',
          'com.tokenaires.sync',
          '/tr',
          '"C:\\node.exe" "C:\\tokenaires\\dist\\cli.js" sync --quiet',
          '/sc',
          'DAILY',
          '/f',
        ],
      },
    ]);
    expect(ctx.lines.join('\n')).toContain('Tokenaires will sync every day.');
  });

  it('removes scheduled task on Windows when turned off', async () => {
    const ctx = testContext({ home, env: {}, platform: 'win32' });
    await schedule(ctx, 'off');
    expect(ctx.commands).toEqual([
      { command: 'schtasks', args: ['/query', '/tn', 'com.tokenaires.sync'] },
      { command: 'schtasks', args: ['/delete', '/tn', 'com.tokenaires.sync', '/f'] },
    ]);
    expect(ctx.lines.join('\n')).toContain('Schedule removed.');
  });

  it('reports when no schedule was set up on Windows', async () => {
    const ctx = testContext({
      home,
      env: {},
      platform: 'win32',
      run: () =>
        Promise.resolve({
          code: 1,
          stdout: '',
          stderr: 'FEHLER: Die angegebene Aufgabe wurde nicht gefunden.',
        }),
    });
    await schedule(ctx, 'off');
    expect(ctx.lines.join('\n')).toContain('No schedule was set up.');
  });

  it('reports a schtasks create failure', async () => {
    const ctx = testContext({
      home,
      env: {},
      platform: 'win32',
      run: () =>
        Promise.resolve({
          code: 1,
          stdout: '',
          stderr: 'ERROR: Access is denied.',
        }),
    });
    await expect(schedule(ctx, 'on')).rejects.toThrow('schtasks could not create the scheduled task: ERROR: Access is denied.');
  });

  it('still schedules from a package runner cache, with a hint to install globally', async () => {
    for (const [platform, runnerPath] of [
      ['linux', '/home/user/.npm/_npx/a1b2c3/node_modules/tokenaires/dist/cli.js'],
      ['linux', '/home/user/.cache/pnpm/dlx/123/node_modules/tokenaires/dist/cli.js'],
      ['darwin', '/Users/user/.bun/install/cache/tokenaires@0.3.0/dist/cli.js'],
      ['win32', 'C:\\Users\\User\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\tokenaires\\dist\\cli.js'],
    ] as const) {
      const ctx = testContext({ home, env: {}, platform, scriptPath: runnerPath });
      await schedule(ctx, 'on');
      expect(ctx.lines.join('\n')).toContain('npm i -g tokenaires');
    }
  });

  it('gives no runner hint for a global install', async () => {
    const ctx = testContext({ home, env: {}, platform: 'linux', scriptPath: '/usr/local/lib/node_modules/tokenaires/dist/cli.js' });
    await schedule(ctx, 'on');
    expect(ctx.lines.join('\n')).not.toContain('npm i -g tokenaires');
  });
});
