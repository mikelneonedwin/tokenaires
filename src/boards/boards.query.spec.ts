import type { SQL } from 'drizzle-orm';
import { rankedTotals } from './boards.query';

function sqlText(query: SQL): string {
  return query.queryChunks
    .map((chunk) => {
      if (typeof chunk === 'string' || typeof chunk === 'number') {
        return String(chunk);
      }
      if (chunk && typeof chunk === 'object') {
        if ('queryChunks' in chunk) return sqlText(chunk);
        if ('value' in chunk) {
          const value: unknown = chunk.value;
          return Array.isArray(value) ? value.join('') : String(value);
        }
      }
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ');
}

describe('rankedTotals', () => {
  it('orders each developer sources by tokens in the period, then by name', () => {
    const text = sqlText(rankedTotals('all', 'all'));
    expect(text).toContain(
      'array_agg(s.source order by s.source_tokens desc, s.source asc) as sources',
    );
    expect(text).toContain('group by d.user_id, u.created_at, d.source');
    expect(text).toContain('group by s.user_id, s.created_at');
    expect(text).toContain('having sum(s.source_tokens) > 0');
  });

  it.each([
    ['week', 7],
    ['month', 30],
  ] as const)('limits the %s board to its window', (period, days) => {
    expect(sqlText(rankedTotals(period, 'all'))).toContain(
      `d.day > current_date - ${days} ::int`,
    );
  });

  it('filters by one source when asked', () => {
    expect(sqlText(rankedTotals('all', 'claude-code'))).toContain(
      'd.source = claude-code',
    );
  });
});
