import { UsageRecord } from '@tokenaires/contracts';
import {
  BucketTotals,
  DayTotal,
  evaluateRecord,
  historyJumps,
  rateBreaches,
  totalTokensOf,
} from './usage.rules';

const now = Date.parse('2026-11-03T12:00:00Z');

const base: UsageRecord = {
  source: 'claude-code',
  recordId: 'msg_011CggL7rskVGoeCVHL8FEK2:req_011CggL7r4PBNcJWqtQWZmPJ',
  model: 'claude-opus-5-5',
  occurredAt: '2026-11-03T11:00:00Z',
  inputTokens: 2,
  outputTokens: 453,
  cacheReadTokens: 27_873,
  cacheWriteTokens: 41_916,
  reasoningTokens: 87,
};

describe('evaluateRecord', () => {
  it('accepts a real looking Claude record', () => {
    expect(evaluateRecord(base, now)).toBeNull();
  });

  it('accepts a Codex record keyed by session and ordinal', () => {
    const codex: UsageRecord = {
      ...base,
      source: 'codex',
      recordId: '01a183fb-b19e-7281-b173-b202b6051a51:18',
      model: 'gpt-6.1-sol',
    };
    expect(evaluateRecord(codex, now)).toBeNull();
  });

  it.each([
    ['gemini-cli', 'session-8c1d2e:msg-0004'],
    ['antigravity', 'traj_7f3a2c91.step.12'],
    ['opencode', 'msg_01JABCDEF0123456789'],
    ['kimi-code', 'session_9681c707-224e-45a2-8870-0a1633dc0c4c:main:42'],
    ['qwen-code', '3f2a1b0c-9d8e-4f7a-b6c5-d4e3f2a1b0c9'],
    ['copilot-cli', 'copilot:7d3c1e9a5b2f4c6d8e0a1b3c5d7e9f01'],
    ['cline', '1761234567890:1761234599123'],
    ['roo-code', '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b:1761234599123'],
    ['kilo-code', 'msg_01JABCDEF0123456789'],
    ['zcode', 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c'],
    [
      'zed',
      '8e484826-f0f6-42bf-8b71-c9d22bd35c5c:01d380b8-79b4-447e-a6fb-a8300858a7ae',
    ],
    [
      'vscode',
      '3cb8431e-3d10-4455-a041-0cbe8166537d:request_96f44ac8-cbf1-4033-9835-5b6f3d5bcc95',
    ],
    ['devin', 'devin-3f9a1c0e7b2d4e6f8a1b3c5d7e9f0a2b'],
    [
      'deepseek-harness',
      'session-2c78dd9c-1095-4b96-9cd1-ee3dad5c7253:1e706ed0-3b3b-4c9d-ac27-a322069a1ade',
    ],
  ] as const)('accepts a native %s record id', (source, recordId) => {
    expect(
      evaluateRecord({ ...base, source, recordId, model: 'gemini-3-pro' }, now),
    ).toBeNull();
  });

  it('rejects malformed native ids and pre-launch Antigravity records', () => {
    const opencode = { ...base, source: 'opencode' as const, model: 'gpt-5' };
    expect(
      evaluateRecord({ ...opencode, recordId: '-starts-with-dash' }, now),
    ).toBe('invalid_record_id');
    expect(
      evaluateRecord({ ...opencode, recordId: 'has spaces in id' }, now),
    ).toBe('invalid_record_id');
    expect(
      evaluateRecord(
        {
          ...opencode,
          source: 'antigravity',
          recordId: 'traj_7f3a2c91.step.1',
          occurredAt: '2025-08-01T00:00:00Z',
        },
        now,
      ),
    ).toBe('before_source_launch');
  });

  it('dates ZCode records against the launch and GLM releases', () => {
    const zcode = {
      ...base,
      source: 'zcode' as const,
      recordId: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
    };
    const at = (model: string, occurredAt: string) =>
      evaluateRecord({ ...zcode, model, occurredAt }, now);
    expect(at('glm-5.2', '2026-06-01T00:00:00Z')).toBe('before_source_launch');
    expect(at('glm-5.2', '2026-07-01T00:00:00Z')).toBeNull();
    expect(at('GLM-5.3-Flash', '2026-08-01T00:00:00Z')).toBe(
      'before_model_release',
    );
    expect(at('glm-5.3-flash', '2026-09-01T00:00:00Z')).toBeNull();
  });

  it('refuses DeepSeek Harness records older than its developer preview', () => {
    const harness = {
      ...base,
      source: 'deepseek-harness' as const,
      recordId:
        'session-2c78dd9c-1095-4b96-9cd1-ee3dad5c7253:1e706ed0-3b3b-4c9d-ac27-a322069a1ade',
      model: 'deepseek-flash',
    };
    expect(
      evaluateRecord({ ...harness, occurredAt: '2026-08-11T23:59:59Z' }, now),
    ).toBe('before_source_launch');
    expect(
      evaluateRecord({ ...harness, occurredAt: '2026-08-12T00:00:00Z' }, now),
    ).toBeNull();
  });

  it('refuses Zed records older than its agent thread store', () => {
    const zed = {
      ...base,
      source: 'zed' as const,
      recordId:
        '8e484826-f0f6-42bf-8b71-c9d22bd35c5c:01d380b8-79b4-447e-a6fb-a8300858a7ae',
      model: 'claude-3-5-sonnet',
    };
    expect(
      evaluateRecord({ ...zed, occurredAt: '2024-12-31T00:00:00Z' }, now),
    ).toBe('before_source_launch');
    expect(
      evaluateRecord({ ...zed, occurredAt: '2025-02-01T00:00:00Z' }, now),
    ).toBeNull();
  });

  it('refuses VS Code records older than its agent store launch', () => {
    const vscode = {
      ...base,
      source: 'vscode' as const,
      recordId:
        '3cb8431e-3d10-4455-a041-0cbe8166537d:request_96f44ac8-cbf1-4033-9835-5b6f3d5bcc95',
      model: 'gpt-6-luna',
    };
    expect(
      evaluateRecord({ ...vscode, occurredAt: '2026-07-31T00:00:00Z' }, now),
    ).toBe('before_source_launch');
    expect(
      evaluateRecord({ ...vscode, occurredAt: '2026-08-15T00:00:00Z' }, now),
    ).toBeNull();
  });

  it('refuses Devin records older than its CLI early access', () => {
    const devin = {
      ...base,
      source: 'devin' as const,
      recordId: 'devin-3f9a1c0e7b2d4e6f8a1b3c5d7e9f0a2b',
      model: 'swe-2-flash-medium',
    };
    expect(
      evaluateRecord({ ...devin, occurredAt: '2026-03-31T23:59:59Z' }, now),
    ).toBe('before_source_launch');
    expect(
      evaluateRecord({ ...devin, occurredAt: '2026-05-01T00:00:00Z' }, now),
    ).toBeNull();
  });

  it.each([
    [{ recordId: 'msg_short' }, 'invalid_record_id'],
    [{ source: 'codex' as const }, 'invalid_record_id'],
    [{ occurredAt: '2026-11-04T12:00:00Z' }, 'future_timestamp'],
    [{ occurredAt: '2024-12-01T00:00:00Z' }, 'before_source_launch'],
    [
      { model: 'claude-opus-4-5-20251101', occurredAt: '2025-06-01T00:00:00Z' },
      'before_model_release',
    ],
    [
      { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      'implausible_ratio',
    ],
    [{ reasoningTokens: 900 }, 'implausible_ratio'],
    [{ outputTokens: 400_000, reasoningTokens: 0 }, 'implausible_ratio'],
    [{ cacheReadTokens: 4_500_000 }, 'implausible_ratio'],
    [{ cacheReadTokens: 2_200_000 }, 'implausible_ratio'],
  ])('rejects %p as %s', (patch, reason) => {
    expect(evaluateRecord({ ...base, ...patch }, now)).toBe(reason);
  });

  it('counts reasoning inside output, not twice', () => {
    expect(totalTokensOf(base)).toBe(2 + 453 + 27_873 + 41_916);
  });

  it('accepts a full 1M context call', () => {
    expect(
      evaluateRecord(
        { ...base, cacheReadTokens: 958_621, inputTokens: 33_040 },
        now,
      ),
    ).toBeNull();
  });
});

describe('rateBreaches', () => {
  const bucket = (patch: Partial<BucketTotals>): BucketTotals => ({
    bucket: '2026-11-01 10:00:00+00',
    outputTokens: 0,
    totalTokens: 0,
    records: 0,
    ...patch,
  });

  it('leaves the heaviest real hour and day seen so far alone', () => {
    expect(
      rateBreaches('hour', [
        bucket({
          outputTokens: 2_097_850,
          totalTokens: 1_731_346_208,
          records: 4_282,
        }),
      ]),
    ).toEqual([]);
    expect(
      rateBreaches('day', [
        bucket({
          outputTokens: 9_809_159,
          totalTokens: 5_570_959_733,
          records: 13_025,
        }),
      ]),
    ).toEqual([]);
  });

  it('reviews huge cache read totals even when output stays small', () => {
    const breaches = rateBreaches('hour', [
      bucket({
        outputTokens: 1_000,
        totalTokens: 4_200_000_000,
        records: 2_000,
      }),
      bucket({ bucket: 'quiet', totalTokens: 10 }),
    ]);
    expect(breaches.map((breach) => breach.rate.metric)).toEqual([
      'totalTokens',
    ]);
    expect(breaches[0]?.bucket.totalTokens).toBe(4_200_000_000);
  });

  it('reviews call floods and output spikes per day', () => {
    const breaches = rateBreaches('day', [
      bucket({
        outputTokens: 41_000_000,
        totalTokens: 15_500_000_000,
        records: 61_000,
      }),
    ]);
    expect(breaches.map((breach) => breach.rate.metric).sort()).toEqual([
      'outputTokens',
      'records',
      'totalTokens',
    ]);
  });
});

describe('historyJumps', () => {
  const history = (
    perDay: number,
    count: number,
    end = '2026-10-31',
  ): DayTotal[] =>
    Array.from({ length: count }, (_, index) => ({
      day: new Date(Date.parse(end) - (count - index) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      totalTokens: perDay,
    }));

  it('reviews a sudden day far above the account median', () => {
    const days = [
      ...history(200_000_000, 20),
      { day: '2026-10-31', totalTokens: 6_000_000_000 },
    ];
    const jumps = historyJumps(days, new Set(['2026-10-31']));
    expect(jumps).toEqual([
      { day: '2026-10-31', totalTokens: 6_000_000_000, baseline: 200_000_000 },
    ]);
  });

  it('leaves heavy but steady accounts and days below the floor alone', () => {
    const steady = [
      ...history(1_000_000_000, 20),
      { day: '2026-10-31', totalTokens: 5_570_959_733 },
    ];
    expect(historyJumps(steady, new Set(['2026-10-31']))).toEqual([]);
    const small = [
      ...history(20_000_000, 20),
      { day: '2026-10-31', totalTokens: 3_171_871_537 },
    ];
    expect(historyJumps(small, new Set(['2026-10-31']))).toEqual([]);
  });

  it('needs a week of history and only checks days in this upload', () => {
    const thin = [
      ...history(100_000_000, 5),
      { day: '2026-10-31', totalTokens: 9_000_000_000 },
    ];
    expect(historyJumps(thin, new Set(['2026-10-31']))).toEqual([]);
    const old = [
      ...history(100_000_000, 20),
      { day: '2026-10-31', totalTokens: 9_000_000_000 },
    ];
    expect(historyJumps(old, new Set(['2026-11-01']))).toEqual([]);
  });
});
