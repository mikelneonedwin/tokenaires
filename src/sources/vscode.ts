import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV_KEYS, readEnv } from '@/config';
import { wslHomes } from '@/files/wsl';
import { parseVsCodeFile, vscodeSignature } from '@/parsers/vscode';
import { expandHome } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const AGENT_SESSION_DIR = 'agentSessionData';
const DB_NAME = 'session.db';
const FLATPAK_CONFIG = ['.var', 'app', 'com.visualstudio.code', 'config', 'Code'];

function linuxConfigDirs(home: string, xdgConfig: string | undefined): string[] {
  const base = xdgConfig ?? join(home, '.config');
  return [
    join(base, 'Code'),
    join(base, 'Code - Insiders'),
    join(base, 'VSCodium'),
    join(home, ...FLATPAK_CONFIG),
  ];
}

export function vscodeConfigDirs(ctx: SourceContext): string[] {
  const configured = readEnv(ctx.env, ENV_KEYS.vscodeDataDir);
  if (configured) return [expandHome(configured, ctx.home)];

  if (ctx.platform === 'darwin') {
    const appSupport = join(ctx.home, 'Library', 'Application Support');
    return [
      join(appSupport, 'Code'),
      join(appSupport, 'Code - Insiders'),
      join(appSupport, 'VSCodium'),
    ];
  }

  if (ctx.platform === 'win32') {
    const appData = readEnv(ctx.env, 'APPDATA') ?? join(ctx.home, 'AppData', 'Roaming');
    return [
      join(appData, 'Code'),
      join(appData, 'Code - Insiders'),
      join(appData, 'VSCodium'),
    ];
  }

  return [...new Set(linuxConfigDirs(ctx.home, readEnv(ctx.env, ENV_KEYS.xdgConfig)))];
}

function remoteServerDirs(homes: string[]): string[] {
  const servers = ['.vscode-server', '.vscode-server-insiders'];
  return homes.flatMap((home) =>
    servers.map((server) => join(home, server, 'data')),
  );
}

async function candidateAgentDirs(ctx: SourceContext): Promise<string[]> {
  const configured = readEnv(ctx.env, ENV_KEYS.vscodeDataDir);
  if (configured) {
    const dir = expandHome(configured, ctx.home);
    return [dir.endsWith(AGENT_SESSION_DIR) ? dir : join(dir, AGENT_SESSION_DIR)];
  }

  const bases = vscodeConfigDirs(ctx);
  const homes = await wslHomes(ctx.platform);
  const linuxHomes = ctx.platform === 'win32' ? homes : [];
  const remoteDirs = remoteServerDirs([ctx.home, ...homes]);

  const allBases = [
    ...bases,
    ...linuxHomes.flatMap((home) => linuxConfigDirs(home, undefined)),
    ...remoteDirs,
  ];

  return [...new Set(allBases.map((base) => join(base, AGENT_SESSION_DIR)))];
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export const vscodeSource: LogSource = {
  source: 'vscode',
  async discover(ctx) {
    const found = new Set<string>();
    for (const agentDir of await candidateAgentDirs(ctx)) {
      if (!(await isDir(agentDir))) continue;
      try {
        const entries = await readdir(agentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dbPath = join(agentDir, entry.name, DB_NAME);
          if (await isFile(dbPath)) {
            found.add(dbPath);
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }
    return [...found];
  },
  parse: parseVsCodeFile,
  signature: vscodeSignature,
};
