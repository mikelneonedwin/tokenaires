import { readFile } from 'node:fs/promises';
import { zstdDecompressSync } from 'node:zlib';
import type { UsageRecord } from '@tokenaires/contracts';
import { child, count, epochTime, nativeId, parseObject, text, type JsonObject } from '@/parsers/json';
import { hasTokens, keepLargest } from '@/parsers/merge';

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const SESSION_TYPE = 'session';
const ASSISTANT_MESSAGE_TYPE = 'assistant/message';

interface Frame {
  start: number;
  end: number;
}

function frameStarts(data: Buffer): number[] {
  const starts: number[] = [];
  let at = data.indexOf(ZSTD_MAGIC, 0);
  while (at !== -1) {
    starts.push(at);
    at = data.indexOf(ZSTD_MAGIC, at + ZSTD_MAGIC.length);
  }
  return starts;
}

function framesOf(data: Buffer): Frame[] {
  const starts = frameStarts(data);
  return starts.map((start, index) => ({
    start,
    end: index + 1 < starts.length ? (starts[index + 1] ?? data.length) : data.length,
  }));
}

function decompress(frame: Frame, data: Buffer): string | null {
  try {
    return zstdDecompressSync(data.subarray(frame.start, frame.end)).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * DeepSeek Harness appends one zstd frame per session event to an otherwise plain JSONL log,
 * so a single `zstdDecompress` call would stop after the first record. Frames start with the
 * zstd magic number; a segment that starts on a magic number but does not decode is extended
 * with the next segment and retried, which recovers from a magic number inside compressed data
 * and keeps a torn trailing frame from hiding everything written before it.
 */
export function decodeHarnessLog(data: Buffer): string[] {
  const frames = framesOf(data);
  if (frames.length === 0) return [data.toString('utf8')];
  const chunks: string[] = [];
  let index = 0;
  while (index < frames.length) {
    const first = frames[index];
    if (first === undefined) break;
    let text: string | null = null;
    let last = index;
    for (let end = index; end < frames.length && text === null; end += 1) {
      const frame = frames[end];
      if (frame === undefined) continue;
      text = decompress({ start: first.start, end: frame.end }, data);
      last = end;
    }
    if (text !== null) {
      chunks.push(text);
      index = last + 1;
    } else {
      index += 1;
    }
  }
  return chunks;
}

function recordFromEntry(entry: JsonObject, sessionId: string | null): UsageRecord | null {
  const data = child(entry, 'data');
  const message = child(data, 'message');
  const usage = child(data, 'usage');
  const messageId = text(message, 'id');
  const model = text(child(message, 'source'), 'model');
  const occurredAt = epochTime(entry.time);
  if (!usage || !messageId || !model || !occurredAt) return null;
  const recordId = sessionId ? nativeId(sessionId, messageId) : nativeId(messageId);
  if (!recordId) return null;
  const record: UsageRecord = {
    source: 'deepseek-harness',
    recordId,
    model,
    occurredAt,
    inputTokens: count(usage, 'inputTokens'),
    outputTokens: count(usage, 'outputTokens'),
    cacheReadTokens: count(usage, 'cacheReadTokens'),
    cacheWriteTokens: count(usage, 'cacheWriteTokens'),
    reasoningTokens: 0,
  };
  return hasTokens(record) ? record : null;
}

export function parseHarnessLine(line: string, sessionId: string | null): UsageRecord | null {
  if (!line.includes(ASSISTANT_MESSAGE_TYPE)) return null;
  const entry = parseObject(line);
  if (!entry || entry.type !== ASSISTANT_MESSAGE_TYPE) return null;
  return recordFromEntry(entry, sessionId);
}

export function readHarnessLog(data: Buffer): UsageRecord[] {
  const into = new Map<string, UsageRecord>();
  let sessionId: string | null = null;
  for (const chunk of decodeHarnessLog(data)) {
    for (const line of chunk.split('\n')) {
      if (line.length === 0) continue;
      const entry = parseObject(line);
      if (!entry) continue;
      if (entry.type === SESSION_TYPE) {
        sessionId = text(entry, 'id') ?? sessionId;
        continue;
      }
      if (entry.type !== ASSISTANT_MESSAGE_TYPE) continue;
      const record = recordFromEntry(entry, sessionId);
      if (record) keepLargest(into, record);
    }
  }
  return [...into.values()];
}

export async function parseDeepseekHarnessFile(path: string): Promise<UsageRecord[] | null> {
  try {
    return readHarnessLog(await readFile(path));
  } catch {
    return null;
  }
}
