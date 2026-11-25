import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { DatabaseSync } from 'node:sqlite';
import type { UsageRecord } from '@tokenaires/contracts';
import { child, count, epochTime, isObject, isoTime, parseObject, text, toCount, type JsonObject } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';
import { dbSignature, withReadOnlyDb } from '@/sqlite/open';

const ID_PREFIX = 'devin:';
const ID_HEX_LENGTH = 32;

export function devinRecordId(sessionId: string, stepId: unknown, occurredAt: string): string | null {
  const step = typeof stepId === 'number' || typeof stepId === 'string' ? String(stepId).trim() : '';
  if (!sessionId.trim() || !step) return null;
  const digest = createHash('sha256').update(`${sessionId}|${step}|${occurredAt}`).digest('hex');
  return `${ID_PREFIX}${digest.slice(0, ID_HEX_LENGTH)}`;
}

export function uncachedInput(promptTokens: number, cachedTokens: number): number {
  return cachedTokens <= promptTokens ? promptTokens - cachedTokens : promptTokens;
}

function modelOf(step: JsonObject, fallbackModel: string | null): string | null {
  const extra = child(step, 'extra');
  const generationModel = extra ? text(extra, 'generation_model') : null;
  return generationModel ?? text(step, 'model_name') ?? fallbackModel;
}

function stepRecord(step: JsonObject, sessionId: string, fallbackModel: string | null): UsageRecord | null {
  if (text(step, 'source') !== 'agent') return null;
  const metrics = child(step, 'metrics');
  if (!metrics) return null;

  const outputTokens = count(metrics, 'completion_tokens');
  if (outputTokens === 0) return null;

  const occurredAt = isoTime(step.timestamp);
  const model = modelOf(step, fallbackModel)?.trim();
  if (!occurredAt || !model) return null;
  const recordId = devinRecordId(sessionId, step.step_id, occurredAt);
  if (!recordId) return null;

  const promptTokens = count(metrics, 'prompt_tokens');
  const cachedTokens = count(metrics, 'cached_tokens');
  const record: UsageRecord = {
    source: 'devin',
    recordId,
    model,
    occurredAt,
    inputTokens: uncachedInput(promptTokens, cachedTokens),
    outputTokens,
    cacheReadTokens: cachedTokens <= promptTokens ? cachedTokens : 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  };

  return hasTokens(record) ? record : null;
}

export function parseDevinContent(content: string): UsageRecord[] | null {
  const root = parseObject(content);
  if (!root) return null;

  const sessionId = text(root, 'session_id');
  if (!sessionId) return null;

  const agent = child(root, 'agent');
  const fallbackModel = agent ? text(agent, 'model_name') : null;

  const steps = root.steps;
  if (!Array.isArray(steps)) return [];

  const records = new Map<string, UsageRecord>();
  for (const step of steps) {
    if (!isObject(step)) continue;
    const record = stepRecord(step, sessionId, fallbackModel);
    if (record && !records.has(record.recordId)) {
      records.set(record.recordId, record);
    }
  }

  return [...records.values()];
}

function hashedId(parts: string[]): string {
  return `${ID_PREFIX}${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, ID_HEX_LENGTH)}`;
}

export function devinDbRecordId(sessionId: string, messageId: unknown, requestId: unknown, nodeId: unknown): string | null {
  const session = sessionId.trim();
  if (!session) return null;
  const message = typeof messageId === 'string' ? messageId.trim() : '';
  const request = typeof requestId === 'string' ? requestId.trim() : '';
  const node = typeof nodeId === 'number' || typeof nodeId === 'string' ? String(nodeId).trim() : '';
  const key = message || request || (node ? `node:${node}` : '');
  return key ? hashedId([session, key]) : null;
}

interface DevinDbRow {
  session_id: unknown;
  node_id: unknown;
  session_model: unknown;
  message_id: unknown;
  request_id: unknown;
  generation_model: unknown;
  created_at: unknown;
  node_created_at: unknown;
  input_tokens: unknown;
  output_tokens: unknown;
  cache_read_tokens: unknown;
  cache_creation_tokens: unknown;
}

function dbText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function dbRecord(row: DevinDbRow): UsageRecord | null {
  const outputTokens = toCount(row.output_tokens);
  if (outputTokens === 0) return null;
  const occurredAt = isoTime(row.created_at) ?? epochTime(row.node_created_at);
  const model = dbText(row.generation_model) ?? dbText(row.session_model);
  const recordId = devinDbRecordId(dbText(row.session_id) ?? '', row.message_id, row.request_id, row.node_id);
  if (!occurredAt || !model || !recordId) return null;
  const record: UsageRecord = {
    source: 'devin',
    recordId,
    model,
    occurredAt,
    inputTokens: toCount(row.input_tokens),
    outputTokens,
    cacheReadTokens: toCount(row.cache_read_tokens),
    cacheWriteTokens: toCount(row.cache_creation_tokens),
    reasoningTokens: 0,
  };
  return hasTokens(record) ? record : null;
}

export function readDevinDb(db: DatabaseSync): UsageRecord[] {
  const tables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: unknown }>).map((row) => String(row.name)),
  );
  if (!tables.has('message_nodes')) return [];
  const joinSessions = tables.has('sessions');
  const modelColumn = joinSessions ? 's.model' : 'NULL';
  const joinClause = joinSessions ? 'LEFT JOIN sessions s ON s.id = mn.session_id' : '';
  const rows = db
    .prepare(
      `SELECT mn.session_id, mn.node_id, ${modelColumn} AS session_model,
        json_extract(mn.chat_message, '$.message_id') AS message_id,
        json_extract(mn.chat_message, '$.metadata.request_id') AS request_id,
        json_extract(mn.chat_message, '$.metadata.generation_model') AS generation_model,
        json_extract(mn.chat_message, '$.metadata.created_at') AS created_at,
        mn.created_at AS node_created_at,
        json_extract(mn.chat_message, '$.metadata.metrics.input_tokens') AS input_tokens,
        json_extract(mn.chat_message, '$.metadata.metrics.output_tokens') AS output_tokens,
        json_extract(mn.chat_message, '$.metadata.metrics.cache_read_tokens') AS cache_read_tokens,
        json_extract(mn.chat_message, '$.metadata.metrics.cache_creation_tokens') AS cache_creation_tokens
      FROM message_nodes mn ${joinClause}
      WHERE json_extract(mn.chat_message, '$.role') = 'assistant'`,
    )
    .all() as unknown as DevinDbRow[];
  const records = new Map<string, UsageRecord>();
  for (const row of rows) {
    const record = dbRecord(row);
    const existing = record ? records.get(record.recordId) : undefined;
    if (record && (!existing || record.outputTokens > existing.outputTokens)) {
      records.set(record.recordId, record);
    }
  }
  return [...records.values()];
}

export async function parseDevinDb(path: string): Promise<UsageRecord[] | null> {
  return withReadOnlyDb(path, readDevinDb);
}

const DB_PATH = /\.(?:db|sqlite3?)$/i;

export async function devinSignature(path: string): Promise<string | null> {
  return DB_PATH.test(path) ? dbSignature(path) : null;
}

export async function parseDevinFile(path: string): Promise<UsageRecord[] | null> {
  try {
    if (DB_PATH.test(path)) return await parseDevinDb(path);
    const content = await readFile(path, 'utf8');
    return parseDevinContent(content);
  } catch {
    return null;
  }
}
