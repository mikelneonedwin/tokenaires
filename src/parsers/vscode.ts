import { stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { UsageRecord } from '@tokenaires/contracts';
import { child, count, epochTime, isObject, isoTime, parseObject, RECORD_ID_PATTERN, text, type JsonObject } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';
import { dbSignature, withReadOnlyDb } from '@/sqlite/open';

interface TurnUsageRow {
  turn_id: unknown;
  usage: unknown;
}

interface AssistantResponsePartRow {
  turn_id: unknown;
  parts: unknown;
}

export function vscodeRecordId(sessionId: string, turnId: string): string | null {
  const recordId = `${sessionId}:${turnId}`;
  return RECORD_ID_PATTERN.test(recordId) ? recordId : null;
}

function timeFromParts(partsJson: unknown): string | null {
  if (typeof partsJson !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(partsJson);
    if (!Array.isArray(parsed)) return null;
    for (const item of parsed) {
      if (isObject(item)) {
        const startedAt = item.startedAt;
        if (typeof startedAt === 'number') {
          const iso = epochTime(startedAt);
          if (iso) return iso;
        } else if (typeof startedAt === 'string') {
          const iso = isoTime(startedAt);
          if (iso) return iso;
        }
      }
    }
  } catch {
    // Ignore invalid JSON in parts
  }
  return null;
}

function timeFromModelCall(modelCall: JsonObject | null): string | null {
  if (!modelCall) return null;
  const started = modelCall.startedAt ?? modelCall.createdAt ?? modelCall.timestamp;
  if (typeof started === 'string' || typeof started === 'number') {
    return isoTime(started);
  }
  return null;
}

function recordFromUsage(
  recordId: string,
  usageObj: JsonObject,
  occurredAt: string,
): UsageRecord | null {
  const model = text(usageObj, 'model')?.trim();
  if (!model) return null;
  const outputTokens = count(usageObj, 'outputTokens');
  if (outputTokens === 0) return null;

  const cacheReadTokens = count(usageObj, 'cacheReadTokens');
  const cacheWriteTokens = count(usageObj, 'cacheWriteTokens');
  const rawTotals: unknown = usageObj['directTurnTokenTotals'];
  const directTotals: unknown = Array.isArray(rawTotals) && rawTotals.length > 0 ? rawTotals[0] : null;
  const reasoningTokens = isObject(directTotals) ? count(directTotals, 'reasoningTokens') : 0;

  const record: UsageRecord = {
    source: 'vscode',
    recordId,
    model,
    occurredAt,
    inputTokens: count(usageObj, 'inputTokens'),
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens: Math.min(reasoningTokens, outputTokens),
  };
  return hasTokens(record) ? record : null;
}

export function readVsCodeDb(db: DatabaseSync, dbPath?: string, fallbackTime?: string | null): UsageRecord[] {
  const turnUsageTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'turn_usage'").get();
  if (!turnUsageTable) return [];

  const sessionId = dbPath ? basename(dirname(dbPath)) : 'vscode-session';

  const partsTimes = new Map<string, string>();
  const partsTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'assistant_response_parts'").get();
  if (partsTable) {
    const partsRows = db.prepare('SELECT turn_id, parts FROM assistant_response_parts').all() as unknown as AssistantResponsePartRow[];
    for (const row of partsRows) {
      if (typeof row.turn_id === 'string' && !partsTimes.has(row.turn_id)) {
        const t = timeFromParts(row.parts);
        if (t) partsTimes.set(row.turn_id, t);
      }
    }
  }

  const rows = db.prepare('SELECT turn_id, usage FROM turn_usage').all() as unknown as TurnUsageRow[];
  const records = new Map<string, UsageRecord>();

  for (const row of rows) {
    if (typeof row.turn_id !== 'string' || typeof row.usage !== 'string') continue;
    const usageObj = parseObject(row.usage);
    if (!usageObj) continue;

    const recordId = vscodeRecordId(sessionId, row.turn_id);
    if (!recordId) continue;

    const meta = child(usageObj, '_meta');
    const modelCall = child(meta, 'vscode.modelCall');
    const occurredAt =
      partsTimes.get(row.turn_id) ??
      timeFromModelCall(modelCall) ??
      fallbackTime ??
      null;

    if (!occurredAt) continue;

    const record = recordFromUsage(recordId, usageObj, occurredAt);
    if (record && !records.has(record.recordId)) {
      records.set(record.recordId, record);
    }
  }

  return [...records.values()];
}

export async function parseVsCodeFile(path: string): Promise<UsageRecord[] | null> {
  let fallbackTime: string | null = null;
  try {
    const fileStat = await stat(path);
    fallbackTime = isoTime(fileStat.mtime.toISOString());
  } catch {
    // If stat fails, fallback remains null
  }
  return withReadOnlyDb(path, (db) => readVsCodeDb(db, path, fallbackTime));
}

export const vscodeSignature = dbSignature;
