import pkg from '../package.json' with { type: 'json' };

export const CLI_NAME = 'tokenaires';
export const CLI_VERSION: string = pkg.version;

export const DEFAULT_API_URL = 'https://tokenaires.cc/api/v1';
export const DEFAULT_WEB_URL = 'https://tokenaires.cc';

export const ENV_KEYS = {
  apiUrl: 'TOKENAIRES_API_URL',
  webUrl: 'TOKENAIRES_WEB_URL',
  xdgConfig: 'XDG_CONFIG_HOME',
  claudeConfig: 'CLAUDE_CONFIG_DIR',
  zcodeConfig: 'ZCODE_CONFIG_DIR',
  codexHome: 'CODEX_HOME',
  geminiHome: 'GEMINI_CLI_HOME',
  xdgData: 'XDG_DATA_HOME',
  openCodeData: 'OPENCODE_DATA_DIR',
  openCodeDbPrefix: 'OPENCODE_DB_PREFIX',
  kimiHome: 'KIMI_CODE_HOME',
  kimiShare: 'KIMI_SHARE_DIR',
  kiloDb: 'KILO_DB',
  copilotHome: 'COPILOT_HOME',
  qwenHome: 'QWEN_HOME',
  qwenRuntime: 'QWEN_RUNTIME_DIR',
  clineDir: 'CLINE_DIR',
  clineData: 'CLINE_DATA_DIR',
  clineSessions: 'CLINE_SESSION_DATA_DIR',
  zedHome: 'ZED_HOME',
  vscodeDataDir: 'VSCODE_DATA_DIR',
  devinSessionsDir: 'DEVIN_SESSIONS_DIR',
  dshHome: 'DSH_HOME',
  noBrowser: 'TOKENAIRES_NO_BROWSER',
  noCache: 'TOKENAIRES_NO_CACHE',
} as const;

export const API_PATHS = {
  deviceStart: '/auth/device/start',
  devicePoll: '/auth/device/poll',
  me: '/me',
  batches: '/usage/batches',
  logout: '/auth/logout',
} as const;

export const UPLOAD_BATCH_SIZE = 1000;
export const CURSOR_OVERLAP_MS = 48 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const PARSE_CONCURRENCY = 8;
export const TOP_MODELS_LIMIT = 5;

export const SCAN_CACHE_FILE_NAME = 'scan-cache.json.gz';
export const SCAN_CACHE_VERSION = 1;
export const SYNC_STATE_FILE_NAME = 'sync-state.json';
export const RECORD_RULES_VERSION = 2;

export const CONFIG_DIR_NAME = 'tokenaires';
export const CONFIG_FILE_NAME = 'config.json';
export const CONFIG_FILE_MODE = 0o600;
export const CONFIG_DIR_MODE = 0o700;

export const SCHEDULE = {
  label: 'com.tokenaires.sync',
  defaultHours: 6,
  minHours: 2,
  maxHours: 24,
  logFileName: 'tokenaires-sync.log',
} as const;

export const SCHEDULE_ENV_PASSTHROUGH = [
  ENV_KEYS.apiUrl,
  ENV_KEYS.webUrl,
  ENV_KEYS.xdgConfig,
  ENV_KEYS.claudeConfig,
  ENV_KEYS.zcodeConfig,
  ENV_KEYS.codexHome,
  ENV_KEYS.geminiHome,
  ENV_KEYS.xdgData,
  ENV_KEYS.openCodeData,
  ENV_KEYS.kimiHome,
  ENV_KEYS.kimiShare,
  ENV_KEYS.kiloDb,
  ENV_KEYS.copilotHome,
  ENV_KEYS.qwenHome,
  ENV_KEYS.qwenRuntime,
  ENV_KEYS.clineDir,
  ENV_KEYS.clineData,
  ENV_KEYS.clineSessions,
  ENV_KEYS.openCodeDbPrefix,
  ENV_KEYS.zedHome,
  ENV_KEYS.vscodeDataDir,
  ENV_KEYS.devinSessionsDir,
  ENV_KEYS.dshHome,
] as const;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function envValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function resolveApiUrl(env: NodeJS.ProcessEnv, stored?: string): string {
  return trimSlash(envValue(env, ENV_KEYS.apiUrl) ?? stored ?? DEFAULT_API_URL);
}

export function resolveWebUrl(env: NodeJS.ProcessEnv): string {
  return trimSlash(envValue(env, ENV_KEYS.webUrl) ?? DEFAULT_WEB_URL);
}

export function profileUrl(env: NodeJS.ProcessEnv, handle: string): string {
  return `${resolveWebUrl(env)}/u/${encodeURIComponent(handle)}`;
}

export function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  return envValue(env, key);
}

export const RATE_LIMIT = {
  defaultWaitMs: 10_000,
  minWaitMs: 1_000,
  maxWaitMs: 120_000,
  maxRetries: 12,
} as const;
