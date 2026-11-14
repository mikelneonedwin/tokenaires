import { z } from 'zod';

export const AGENT_SOURCES = [
  'claude-code',
  'codex',
  'gemini-cli',
  'antigravity',
  'opencode',
  'kimi-code',
  'qwen-code',
  'copilot-cli',
  'cline',
  'roo-code',
  'kilo-code',
  'zcode',
  'zed',
  'vscode',
  'devin',
  'deepseek-harness',
] as const;

export const AgentSourceSchema = z.enum(AGENT_SOURCES);
export type AgentSource = z.infer<typeof AgentSourceSchema>;

export const AGENT_SOURCE_LABELS: Record<AgentSource, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'gemini-cli': 'Gemini CLI',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
  'kimi-code': 'Kimi Code',
  'qwen-code': 'Qwen Code',
  'copilot-cli': 'Copilot CLI',
  cline: 'Cline',
  'roo-code': 'Roo Code',
  'kilo-code': 'Kilo Code',
  zcode: 'ZCode',
  zed: 'Zed',
  vscode: 'VS Code',
  devin: 'Devin',
  'deepseek-harness': 'DeepSeek Harness',
};
