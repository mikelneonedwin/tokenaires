import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { UsageRecord } from '@tokenaires/contracts';
import { child, count, isObject, isoTime, parseObject, text, type JsonObject } from '@/parsers/json';
import { hasTokens } from '@/parsers/merge';

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

export async function parseDevinFile(path: string): Promise<UsageRecord[] | null> {
  try {
    const content = await readFile(path, 'utf8');
    return parseDevinContent(content);
  } catch {
    return null;
  }
}
