import { delimiter, isAbsolute, join } from 'node:path';
import { ENV_KEYS, readEnv } from '@/config';

const SPLIT = new RegExp(`[,${delimiter === ';' ? ';' : ':'}]`);
const ANTIGRAVITY_APPS = ['antigravity', 'antigravity-cli', 'antigravity-ide'];

export function expandHome(dir: string, home: string): string {
  if (dir === '~') return home;
  if (dir.startsWith('~/') || dir.startsWith('~\\')) return join(home, dir.slice(2));
  return dir;
}

export function splitDirs(value: string, home: string): string[] {
  return value
    .split(SPLIT)
    .map((dir) => dir.trim())
    .filter((dir) => dir.length > 0)
    .map((dir) => expandHome(dir, home));
}

export function claudeConfigDirs(env: NodeJS.ProcessEnv, home: string): string[] {
  const configured = readEnv(env, ENV_KEYS.claudeConfig);
  if (configured) return splitDirs(configured, home);
  const xdg = readEnv(env, ENV_KEYS.xdgConfig);
  const dirs = [join(home, '.claude'), join(home, '.config', 'claude')];
  return xdg ? [...new Set([...dirs, join(xdg, 'claude')])] : dirs;
}

export function claudeRoots(env: NodeJS.ProcessEnv, home: string): string[] {
  return claudeConfigDirs(env, home).map((dir) => join(dir, 'projects'));
}

export function zcodeConfigDirs(env: NodeJS.ProcessEnv, home: string): string[] {
  const configured = readEnv(env, ENV_KEYS.zcodeConfig);
  if (configured) return splitDirs(configured, home);
  const xdg = readEnv(env, ENV_KEYS.xdgConfig);
  const dirs = [join(home, '.zcode'), join(home, '.config', 'zcode')];
  return xdg ? [...new Set([...dirs, join(xdg, 'zcode')])] : dirs;
}

export function zcodeRoots(env: NodeJS.ProcessEnv, home: string): string[] {
  return zcodeConfigDirs(env, home).map((dir) => join(dir, 'cli', 'rollout'));
}

export function claudeDesktopRoots(env: NodeJS.ProcessEnv, home: string, platform: NodeJS.Platform): string[] {
  const leaf = 'local-agent-mode-sessions';
  if (platform === 'darwin') {
    const support = join(home, 'Library', 'Application Support');
    return [join(support, 'Claude', leaf), join(support, 'Claude-3p', leaf)];
  }
  if (platform === 'win32') {
    return [join(readEnv(env, 'APPDATA') ?? join(home, 'AppData', 'Roaming'), 'Claude', leaf)];
  }
  return [join(readEnv(env, ENV_KEYS.xdgConfig) ?? join(home, '.config'), 'Claude', leaf)];
}

export function codexHome(env: NodeJS.ProcessEnv, home: string): string {
  return expandHome(readEnv(env, ENV_KEYS.codexHome) ?? join(home, '.codex'), home);
}

export function codexRoots(env: NodeJS.ProcessEnv, home: string): string[] {
  const base = codexHome(env, home);
  return [join(base, 'sessions'), join(base, 'archived_sessions')];
}

export function geminiTmpRoot(env: NodeJS.ProcessEnv, home: string): string {
  return join(readEnv(env, ENV_KEYS.geminiHome) ?? home, '.gemini', 'tmp');
}

export function antigravityRoots(home: string): string[] {
  return ANTIGRAVITY_APPS.map((app) => join(home, '.gemini', app, 'conversations'));
}

export function openCodeDataDir(env: NodeJS.ProcessEnv, home: string): string {
  const override = readEnv(env, ENV_KEYS.openCodeData);
  if (override) return expandHome(override, home);
  return join(readEnv(env, ENV_KEYS.xdgData) ?? join(home, '.local', 'share'), 'opencode');
}

export function openCodeDbPrefix(env: NodeJS.ProcessEnv): string {
  return readEnv(env, ENV_KEYS.openCodeDbPrefix) ?? 'opencode';
}

export function kimiSessionsRoot(env: NodeJS.ProcessEnv, home: string): string {
  const override = readEnv(env, ENV_KEYS.kimiHome);
  return join(override ? expandHome(override, home) : join(home, '.kimi-code'), 'sessions');
}

export function kimiLegacySessionsRoot(env: NodeJS.ProcessEnv, home: string): string {
  const override = readEnv(env, ENV_KEYS.kimiShare);
  return join(override ? expandHome(override, home) : join(home, '.kimi'), 'sessions');
}

export function deepseekHarnessSessionsRoot(env: NodeJS.ProcessEnv, home: string): string {
  const override = readEnv(env, ENV_KEYS.dshHome);
  return join(override ? expandHome(override, home) : join(home, '.dsh'), 'sessions');
}

export function kiloDataDir(env: NodeJS.ProcessEnv, home: string): string {
  return join(readEnv(env, ENV_KEYS.xdgData) ?? join(home, '.local', 'share'), 'kilo');
}

export function kiloDbOverride(env: NodeJS.ProcessEnv, home: string): string | null {
  const configured = readEnv(env, ENV_KEYS.kiloDb);
  if (!configured || configured === ':memory:') return null;
  const path = expandHome(configured, home);
  return isAbsolute(path) ? path : join(kiloDataDir(env, home), path);
}
