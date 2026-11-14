import {
  AgentSource,
  RejectionReason,
  UsageRecord,
} from '@tokenaires/contracts';

const NATIVE_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,159}$/;

export const RECORD_ID_PATTERNS: Record<AgentSource, RegExp> = {
  'claude-code': /^msg_[A-Za-z0-9_-]{16,64}(:req_[A-Za-z0-9_-]{16,64})?$/,
  codex:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{1,7}$/i,
  'gemini-cli': NATIVE_RECORD_ID,
  antigravity: NATIVE_RECORD_ID,
  opencode: NATIVE_RECORD_ID,
  'kimi-code': NATIVE_RECORD_ID,
  'qwen-code': NATIVE_RECORD_ID,
  'copilot-cli': NATIVE_RECORD_ID,
  cline: NATIVE_RECORD_ID,
  'roo-code': NATIVE_RECORD_ID,
  'kilo-code': NATIVE_RECORD_ID,
  zcode: NATIVE_RECORD_ID,
  zed: NATIVE_RECORD_ID,
  vscode: NATIVE_RECORD_ID,
  devin: NATIVE_RECORD_ID,
  'deepseek-harness': NATIVE_RECORD_ID,
};

export const SOURCE_LAUNCH_DATES: Record<AgentSource, string> = {
  'claude-code': '2025-02-20T00:00:00Z',
  codex: '2025-04-14T00:00:00Z',
  'gemini-cli': '2025-06-01T00:00:00Z',
  antigravity: '2025-11-01T00:00:00Z',
  opencode: '2025-04-01T00:00:00Z',
  'kimi-code': '2025-08-01T00:00:00Z',
  'qwen-code': '2025-07-01T00:00:00Z',
  'copilot-cli': '2025-09-01T00:00:00Z',
  cline: '2024-06-01T00:00:00Z',
  'roo-code': '2024-10-01T00:00:00Z',
  'kilo-code': '2025-03-01T00:00:00Z',
  zcode: '2026-06-28T00:00:00Z',
  zed: '2025-01-01T00:00:00Z',
  vscode: '2026-08-01T00:00:00Z',
  devin: '2026-04-01T00:00:00Z',
  'deepseek-harness': '2026-08-12T00:00:00Z',
};

export const MODEL_RELEASE_DATES: ReadonlyArray<{
  prefix: string;
  releasedAt: string;
}> = [
  { prefix: 'claude-sonnet-4-5', releasedAt: '2025-09-27T00:00:00Z' },
  { prefix: 'claude-haiku-4-5', releasedAt: '2025-10-13T00:00:00Z' },
  { prefix: 'claude-opus-4-5', releasedAt: '2025-11-22T00:00:00Z' },
  { prefix: 'claude-opus-4-1', releasedAt: '2025-08-03T00:00:00Z' },
  { prefix: 'claude-opus-4', releasedAt: '2025-05-20T00:00:00Z' },
  { prefix: 'claude-sonnet-4', releasedAt: '2025-05-20T00:00:00Z' },
  { prefix: 'gpt-5-codex', releasedAt: '2025-09-13T00:00:00Z' },
  { prefix: 'glm-5.3', releasedAt: '2026-08-12T00:00:00Z' },
  { prefix: 'glm-5.2', releasedAt: '2026-06-14T00:00:00Z' },
];

export const PLAUSIBILITY = {
  futureSkewMs: 10 * 60 * 1000,
  maxOutputPerRecord: 300_000,
  maxTotalPerRecord: 2_100_000,
} as const;

export interface RateLimit {
  metric: 'outputTokens' | 'totalTokens' | 'records';
  unit: 'hour' | 'day';
  limit: number;
}

export const REVIEW_RATES: readonly RateLimit[] = [
  { metric: 'outputTokens', unit: 'hour', limit: 5_000_000 },
  { metric: 'outputTokens', unit: 'day', limit: 40_000_000 },
  { metric: 'totalTokens', unit: 'hour', limit: 4_000_000_000 },
  { metric: 'totalTokens', unit: 'day', limit: 15_000_000_000 },
  { metric: 'records', unit: 'hour', limit: 15_000 },
  { metric: 'records', unit: 'day', limit: 60_000 },
];

export const HISTORY_JUMP = {
  minDayTotal: 4_000_000_000,
  multipleOfMedian: 15,
  lookbackDays: 30,
  minHistoryDays: 7,
} as const;

export interface DayTotal {
  day: string;
  totalTokens: number;
}

const DAY_MS = 86_400_000;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function historyJumps(
  days: readonly DayTotal[],
  touched: ReadonlySet<string>,
): Array<DayTotal & { baseline: number }> {
  return days.flatMap((current) => {
    if (!touched.has(current.day)) return [];
    if (current.totalTokens <= HISTORY_JUMP.minDayTotal) return [];
    const end = Date.parse(current.day);
    const start = end - HISTORY_JUMP.lookbackDays * DAY_MS;
    const history = days
      .filter((day) => {
        const at = Date.parse(day.day);
        return at >= start && at < end && day.totalTokens > 0;
      })
      .map((day) => day.totalTokens);
    if (history.length < HISTORY_JUMP.minHistoryDays) return [];
    const baseline = median(history);
    return current.totalTokens > baseline * HISTORY_JUMP.multipleOfMedian
      ? [{ ...current, baseline }]
      : [];
  });
}

export interface BucketTotals {
  bucket: string;
  outputTokens: number;
  totalTokens: number;
  records: number;
}

export function rateBreaches(
  unit: RateLimit['unit'],
  buckets: readonly BucketTotals[],
): Array<{ rate: RateLimit; bucket: BucketTotals }> {
  return REVIEW_RATES.filter((rate) => rate.unit === unit).flatMap((rate) => {
    const peak = buckets.reduce<BucketTotals | null>(
      (best, bucket) =>
        best === null || bucket[rate.metric] > best[rate.metric]
          ? bucket
          : best,
      null,
    );
    return peak && peak[rate.metric] > rate.limit
      ? [{ rate, bucket: peak }]
      : [];
  });
}

export function totalTokensOf(record: UsageRecord): number {
  return (
    record.inputTokens +
    record.outputTokens +
    record.cacheReadTokens +
    record.cacheWriteTokens
  );
}

function releaseDateFor(model: string): number | null {
  const normalized = model.toLowerCase();
  const match = MODEL_RELEASE_DATES.find((entry) =>
    normalized.startsWith(entry.prefix),
  );
  return match ? Date.parse(match.releasedAt) : null;
}

export function evaluateRecord(
  record: UsageRecord,
  now: number,
): RejectionReason | null {
  if (!RECORD_ID_PATTERNS[record.source].test(record.recordId))
    return 'invalid_record_id';
  const occurredAt = Date.parse(record.occurredAt);
  if (occurredAt > now + PLAUSIBILITY.futureSkewMs) return 'future_timestamp';
  if (occurredAt < Date.parse(SOURCE_LAUNCH_DATES[record.source]))
    return 'before_source_launch';
  const releasedAt = releaseDateFor(record.model);
  if (releasedAt !== null && occurredAt < releasedAt)
    return 'before_model_release';
  const inputSide =
    record.inputTokens + record.cacheReadTokens + record.cacheWriteTokens;
  if (record.outputTokens > 0 && inputSide === 0) return 'implausible_ratio';
  if (record.reasoningTokens > record.outputTokens) return 'implausible_ratio';
  if (record.outputTokens > PLAUSIBILITY.maxOutputPerRecord)
    return 'implausible_ratio';
  if (totalTokensOf(record) > PLAUSIBILITY.maxTotalPerRecord)
    return 'implausible_ratio';
  return null;
}
