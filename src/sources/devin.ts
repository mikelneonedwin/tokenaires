import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV_KEYS, readEnv } from '@/config';
import { wslHomes } from '@/files/wsl';
import { parseDevinFile } from '@/parsers/devin';
import { expandHome } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const TRANSCRIPTS_DIR = 'transcripts';

function linuxDataDirs(home: string, xdgData: string | undefined): string[] {
  return [
    join(xdgData ?? join(home, '.local', 'share'), 'devin', 'cli'),
    join(home, '.local', 'share', 'devin', 'cli'),
  ];
}

export function devinDataDirs(ctx: SourceContext): string[] {
  const configured = readEnv(ctx.env, ENV_KEYS.devinSessionsDir);
  if (configured) return [expandHome(configured, ctx.home)];

  if (ctx.platform === 'darwin') {
    return [
      join(ctx.home, 'Library', 'Application Support', 'devin', 'cli'),
      join(ctx.home, '.local', 'share', 'devin', 'cli'),
    ];
  }

  if (ctx.platform === 'win32') {
    const appData = readEnv(ctx.env, 'APPDATA') ?? join(ctx.home, 'AppData', 'Roaming');
    const localAppData = readEnv(ctx.env, 'LOCALAPPDATA') ?? join(ctx.home, 'AppData', 'Local');
    return [
      join(appData, 'devin', 'cli'),
      join(localAppData, 'devin', 'cli'),
    ];
  }

  return [...new Set(linuxDataDirs(ctx.home, readEnv(ctx.env, ENV_KEYS.xdgData)))];
}

async function candidateDirs(ctx: SourceContext): Promise<string[]> {
  const base = devinDataDirs(ctx);
  if (readEnv(ctx.env, ENV_KEYS.devinSessionsDir)) return base;
  const homes = await wslHomes(ctx.platform);
  return [...base, ...homes.flatMap((home) => linuxDataDirs(home, undefined))];
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export const devinSource: LogSource = {
  source: 'devin',
  async discover(ctx) {
    const found = new Set<string>();
    for (const dir of await candidateDirs(ctx)) {
      const candidates = [join(dir, TRANSCRIPTS_DIR), dir];
      for (const target of candidates) {
        if (!(await isDir(target))) continue;
        try {
          const entries = await readdir(target, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
              found.add(join(target, entry.name));
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    }
    return [...found];
  },
  parse: parseDevinFile,
};
