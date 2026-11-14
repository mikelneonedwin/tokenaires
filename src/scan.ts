import { stat } from 'node:fs/promises';
import { AGENT_SOURCES, type AgentSource, type UsageRecord } from '@tokenaires/contracts';
import { PARSE_CONCURRENCY } from '@/config';
import { loadScanCache, scanCachePath, type ScanCache } from '@/cache/scan-cache';
import { runPool } from '@/files/lines';
import { keepLargest } from '@/parsers/merge';
import { ScanTracker, type ScanProgressListener } from '@/scan-progress';
import { antigravitySource } from '@/sources/antigravity';
import { claudeSource } from '@/sources/claude';
import { clineSource, rooSource } from '@/sources/cline';
import { codexSource } from '@/sources/codex';
import { copilotSource } from '@/sources/copilot';
import { deepseekHarnessSource } from '@/sources/deepseek-harness';
import { geminiSource } from '@/sources/gemini';
import { kiloSource } from '@/sources/kilo';
import { kimiSource } from '@/sources/kimi';
import { openCodeSource } from '@/sources/opencode';
import { qwenSource } from '@/sources/qwen';
import { zcodeSource } from '@/sources/zcode';
import { zedSource } from '@/sources/zed';
import { vscodeSource } from '@/sources/vscode';
import { devinSource } from '@/sources/devin';
import type { LogSource, SourceContext } from '@/sources/types';

export const LOG_SOURCES: readonly LogSource[] = [claudeSource, codexSource, geminiSource, antigravitySource, openCodeSource, kimiSource, qwenSource, copilotSource, clineSource, rooSource, kiloSource, zcodeSource, zedSource, devinSource, deepseekHarnessSource, vscodeSource];

export interface ScanOptions {
  env: NodeJS.ProcessEnv;
  home: string;
  platform?: NodeJS.Platform;
  cachePath?: string | null;
  onProgress?: ScanProgressListener;
}

export interface ScanResult {
  records: UsageRecord[];
  files: Record<AgentSource, number>;
  cachedFiles: number;
}

async function fileSignature(path: string): Promise<string | null> {
  try {
    const info = await stat(path);
    return `${info.size}:${info.mtimeMs}`;
  } catch {
    return null;
  }
}

async function readOne(source: LogSource, path: string, cache: ScanCache): Promise<{ records: UsageRecord[]; cached: boolean }> {
  const sig = (await source.signature?.(path)) ?? (await fileSignature(path));
  const hit = sig ? cache.get(path, sig) : null;
  if (hit) return { records: hit, cached: true };
  const records = await source.parse(path);
  if (records && sig) cache.set(path, sig, source.source, records);
  return { records: records ?? [], cached: false };
}

async function collect(
  source: LogSource,
  ctx: SourceContext,
  cache: ScanCache,
  tracker: ScanTracker,
): Promise<{ records: UsageRecord[]; files: number }> {
  const files = await source.discover(ctx);
  tracker.discovered(source.source, files.length);
  const perFile: UsageRecord[][] = new Array<UsageRecord[]>(files.length);
  const order = files.map((file, index) => ({ file, index }));
  await runPool(order, PARSE_CONCURRENCY, async ({ file, index }) => {
    const result = await readOne(source, file, cache);
    perFile[index] = result.records;
    tracker.fileRead(source.source, result.cached);
  });
  const into = new Map<string, UsageRecord>();
  for (const records of perFile) for (const record of records) keepLargest(into, record);
  return { records: [...into.values()], files: files.length };
}

export function byTime(a: UsageRecord, b: UsageRecord): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
  return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0;
}

function emptyCounts(): Record<AgentSource, number> {
  return Object.fromEntries(AGENT_SOURCES.map((source) => [source, 0])) as Record<AgentSource, number>;
}

export async function scanLocal(options: ScanOptions): Promise<ScanResult> {
  const ctx: SourceContext = { env: options.env, home: options.home, platform: options.platform ?? process.platform };
  const cachePath = options.cachePath === undefined ? scanCachePath(options.env, options.home) : options.cachePath;
  const cache = await loadScanCache(cachePath);
  const tracker = new ScanTracker(LOG_SOURCES.length, options.onProgress);
  const results = await Promise.all(LOG_SOURCES.map((source) => collect(source, ctx, cache, tracker)));
  await cache.save();
  const files = emptyCounts();
  LOG_SOURCES.forEach((source, index) => {
    files[source.source] = results[index]?.files ?? 0;
  });
  return { records: results.flatMap((result) => result.records).sort(byTime), files, cachedFiles: cache.hits };
}
