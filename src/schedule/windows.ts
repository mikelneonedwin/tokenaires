import { SCHEDULE } from '@/config';
import type { ScheduleTarget } from '@/schedule/launchd';

const HOURS_PER_DAY = 24;

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function windowsTaskRun(target: ScheduleTarget): string {
  return [quote(target.nodePath), quote(target.scriptPath), 'sync', '--quiet'].join(' ');
}

export function windowsCreateArguments(target: ScheduleTarget): string[] {
  const interval = target.hours >= HOURS_PER_DAY ? ['/sc', 'DAILY'] : ['/sc', 'HOURLY', '/mo', String(target.hours)];
  return ['/create', '/tn', SCHEDULE.label, '/tr', windowsTaskRun(target), ...interval, '/f'];
}

export function windowsQueryArguments(): string[] {
  return ['/query', '/tn', SCHEDULE.label];
}

export function windowsDeleteArguments(): string[] {
  return ['/delete', '/tn', SCHEDULE.label, '/f'];
}

const RUNNER_CACHE = [/(^|\/)_npx\//i, /(^|\/)pnpm\/dlx\//i, /(^|\/)dlx-[^/]+\//i, /(^|\/)\.bun\/install\/cache\//i, /(^|\/)bunx-[^/]+\//i];

export function isPackageRunnerPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return RUNNER_CACHE.some((pattern) => pattern.test(normalized));
}
