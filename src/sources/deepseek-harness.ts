import { join } from 'node:path';
import { ENV_KEYS, readEnv } from '@/config';
import { findAll, type FileFilter } from '@/files/walk';
import { wslHomes } from '@/files/wsl';
import { parseDeepseekHarnessFile } from '@/parsers/deepseek-harness';
import { deepseekHarnessSessionsRoot } from '@/parsers/paths';
import type { LogSource, SourceContext } from '@/sources/types';

const SESSION_LOG_NAME = /^session\.[A-Za-z0-9_.-]+\.jsonl(\.zstd)?$/;

const isSessionLog: FileFilter = (_path, name) => SESSION_LOG_NAME.test(name);

async function roots(ctx: SourceContext): Promise<string[]> {
  const base = [deepseekHarnessSessionsRoot(ctx.env, ctx.home)];
  if (readEnv(ctx.env, ENV_KEYS.dshHome)) return base;
  const homes = await wslHomes(ctx.platform);
  return [...base, ...homes.map((home) => join(home, '.dsh', 'sessions'))];
}

export const deepseekHarnessSource: LogSource = {
  source: 'deepseek-harness',
  async discover(ctx) {
    return findAll(await roots(ctx), isSessionLog);
  },
  parse: parseDeepseekHarnessFile,
};
