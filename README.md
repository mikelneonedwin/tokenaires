# tokenaires

The command line client for Tokenaires, the public rich list for developers ranked by AI tokens used.

It reads the usage logs your coding agents already keep on your machine, and uploads one small numeric record per model call. Your prompts, code and file paths never leave your computer.

## Install and run

```sh
npx tokenaires
```

The first run logs you in, then syncs. Requires Node.js 22.15 or newer, which brings the built in SQLite reader and zstd support the CLI uses.

To install it globally instead:

```sh
npm install -g tokenaires
tokenaires
```

## Commands

| Command | What it does |
| --- | --- |
| `tokenaires` | Logs in if needed, then syncs. |
| `tokenaires login` | Connects this device with a code you approve in the browser. |
| `tokenaires scan` | Reads local logs and prints totals per source, top models, record count and date range. Sends nothing and needs no login or network. Also available as `tokenaires --dry-run`. Files that have not changed since the last scan are read from the local scan cache. |
| `tokenaires sync [--quiet]` | Uploads new records, then prints accepted, already synced and rejected counts, your rank and your profile link. |
| `tokenaires status` | Shows login state, handle, rank, tier and progress to the next tier. |
| `tokenaires logout` | Signs this device out on the server, then deletes the saved login and device key. Offline, it still deletes them and says the server copy of the token stays active. |
| `tokenaires schedule on [--every <hours>]` | macOS: installs a LaunchAgent that runs `sync --quiet` every 6 hours, or at the interval you pick with `--every` (whole hours from 2 to 24, for example `--every 2h`, `--every 12h` or `--every 1d`). Windows: creates a Task Scheduler task via `schtasks`. Linux: prints a crontab line to add. Run it again with a new `--every` to change the interval. |
| `tokenaires schedule off` | macOS: unloads and removes the LaunchAgent. Windows: removes the Task Scheduler task. Linux: prints the line to remove. |

In a terminal, `scan` and `sync` show a live progress bar while logs are read and records upload, then a summary card with your tier, ranks and progress to the next tier. When output is piped, in CI, or with `TERM=dumb`, they print plain result lines without animation, and `NO_COLOR=1` turns colours off. `sync --quiet` prints nothing unless something goes wrong.

The LaunchAgent lives at `~/Library/LaunchAgents/com.tokenaires.sync.plist` and points at the Node binary and script you ran it with. If you used `npx`, install globally first so the path stays valid.

## What is read

Everything is read locally. Text logs are read line by line, and only lines that can carry usage are decoded. Databases are opened read only and are never written to. Only records with exact token counts reported by the provider and a stable id from the tool itself are counted. Nothing is estimated from text.

- **Claude Code:** every `*.jsonl` file under `projects` in each Claude config folder, including nested subagent and workflow folders. The folders are `$CLAUDE_CONFIG_DIR` when set (a list separated by commas or the path separator, `~` allowed), otherwise `~/.claude`, `~/.config/claude` and `$XDG_CONFIG_HOME/claude`. On Windows the Claude and Codex homes inside WSL distros are read too. Claude Desktop agent sessions are read from the transcripts under `local-agent-mode-sessions/**/.claude/projects` (the audit logs next to them are skipped, they repeat the same calls). Only assistant lines with a message id and usage block are used. `<synthetic>` and zero usage lines are skipped. Streamed duplicates are merged, keeping the line with the final output count, and a call that appears in two files is counted once. Advisor calls recorded inside a message are counted under the advisor model.
- **Codex:** every `*.jsonl` and zstd compressed `*.jsonl.zst` rollout under `$CODEX_HOME/sessions` and `$CODEX_HOME/archived_sessions` (`CODEX_HOME` defaults to `~/.codex`). A compressed copy next to a plain file of the same name is skipped, and archived copies count once. Once a rollout writes `token_usage_record` lines they are the only source for that rollout, so compaction calls are counted and the context updates written after them are not. Older rollouts use `token_count` events, skipping re-emitted events and counting calls after a counter reset. History that a forked or spawned session copies from its parent is recognised and skipped, so it is never counted twice.
- **Gemini CLI:** session files under `~/.gemini/tmp/*/chats`, including subagent folders and the older single JSON format (`GEMINI_CLI_HOME` moves the base folder). Each Gemini message with recorded usage counts once, keeping its last write. Cached tokens are split out of input, thinking tokens are added to output, and tool prompt tokens count as input when the reported total includes them.
- **Antigravity:** conversation databases under `~/.gemini/antigravity/conversations`, `~/.gemini/antigravity-cli/conversations` and `~/.gemini/antigravity-ide/conversations`. Each generation row with a usage block and response id counts once. Conversations kept only as `.pb` files carry no readable usage and are skipped.
- **OpenCode:** `opencode*.db` in `$OPENCODE_DATA_DIR`, or `$XDG_DATA_HOME/opencode` (default `~/.local/share/opencode`), from both the 1.x and 2.x table layouts, plus the older file based message store under `storage/message`. Assistant and compaction messages with usage count once per message id. The `OPENCODE_DB_PREFIX` variable changes the database file prefix.
- **Kimi Code:** each agent's `wire.jsonl` under `~/.kimi-code/sessions` (`KIMI_CODE_HOME` moves it), main agent and subagents alike. Every `usage.record` line is one model call with exact input, output and cache counts, labelled with the model from the request before it. A forked session starts with a copy of its parent's log, so only the lines after the fork marker are counted. Sessions from the older Python kimi-cli under `~/.kimi/sessions` (`KIMI_SHARE_DIR` moves it) are read too, counting each provider message id once and taking the model name from `config.toml`.
- **Qwen Code:** chat logs under `~/.qwen/projects/*/chats`, archived chats, subagent transcripts under `subagents`, and the older JSON sessions under `~/.qwen/tmp/*/chats` (`QWEN_HOME` moves the base folder, and `QWEN_RUNTIME_DIR` is read as well). Each assistant turn with usage counts once by its id, so a branched copy of a session is not counted twice. Cached tokens are split out of input. Thinking tokens count as output only when the reported total shows they were billed separately, because some backends estimate them from text. Subagent turns take their model from the agent's metadata file.
- **Copilot CLI:** the `assistant_usage_events` table in `~/.copilot/session-store.db` (`COPILOT_HOME` moves it), one row per request including compaction. Cached tokens are split out of input. The per session totals written at shutdown are skipped, because they add up across resumes.
- **Kilo Code:** `kilo.db` and channel databases in `$XDG_DATA_HOME/kilo` (default `~/.local/share/kilo`), which use the OpenCode layout, plus a database named by `KILO_DB`. Sessions Kilo imported from its old extension carry zero usage and are skipped.
- **ZCode:** every `model-io-sess_*.jsonl` rollout file under `cli/rollout` in each ZCode config folder. The folders are `$ZCODE_CONFIG_DIR` when set (a list separated by commas or the path separator, `~` allowed), otherwise `~/.zcode`, `~/.config/zcode` and `$XDG_CONFIG_HOME/zcode`. On Windows the ZCode homes inside WSL distros are read too. Each rollout line is one model API call with the usage under `response.usage`; retried requests repeat the request id with a higher attempt number and only the final attempt is kept, lines without a usage block or with zero usage are skipped, and no request or response payload text is stored. Cached tokens are split out of input, and thinking tokens count as output only when the reported total shows they were billed separately.
- **Zed:** the agent thread database `threads/threads.db` in Zed's data folder: `~/Library/Application Support/Zed` on macOS, `%LOCALAPPDATA%\Zed` on Windows, and `$XDG_DATA_HOME/zed` (default `~/.local/share/zed`) or the Flatpak folder on Linux. `ZED_HOME` points at another data folder or at the folder holding `threads.db`. On Windows the Zed data inside WSL distros is read too. Each thread is zstd compressed JSON, and only the numeric counts under `request_token_usage` are read, one record per thread and user message. Zed keeps only the last model request of each turn there, so turns that ran several tool calls are under-counted, never over-counted. Entries Zed writes for a request that overflowed the context window carry no output and are skipped. Zed stores the model and update time per thread, not per message, so each new message takes the thread's model and last update time. Prompts, code, titles and conversation text are never read into records.
- **VS Code:** the session database `agentSessionData/<session-id>/session.db` under VS Code's user configuration folder: `~/Library/Application Support/Code` on macOS, `%APPDATA%\Code` on Windows, and `~/.config/Code` or the Flatpak folder on Linux. `VSCODE_DATA_DIR` points at a custom configuration directory or directly at `agentSessionData`. Only the `turn_usage` table with provider-reported exact token counts is read, recording input, output, cache read and cache write tokens per turn. Turns with zero output tokens or missing models are skipped. Turn timestamps are extracted from the assistant response events or fallback to file modification time. Prompt text, responses, and user messages are never read into records.
- **Devin:** trajectory transcripts under `~/.local/share/devin/cli/transcripts` (macOS `~/Library/Application Support/devin/cli/transcripts`, Windows `%APPDATA%\devin\cli\transcripts`, or `DEVIN_SESSIONS_DIR` when set). Sessions inside WSL distros on Windows and sessions driven by the Devin Desktop IDE are read too. Each JSON trajectory file contains the session trajectory in ATIF format; only agent steps with a non-zero `completion_tokens` count are read, one record per session and step. ATIF counts cached tokens inside `prompt_tokens`, so they are split out of input. The record id is a hash of the session id, step id and step time, because Devin session names are short and repeat between people. Prompts, code, tools and conversation text are never read into records.
- **DeepSeek Harness:** the session logs under `sessions/*/session-*/` in the DeepSeek Harness data folder, `~/.dsh` on every platform, or `DSH_HOME` when it points elsewhere. On Windows the data inside WSL distros is read too. Harness appends one zstd frame per session event to each `session.v*.jsonl.zstd`, so every frame is decompressed on its own; a torn frame at the end of a session still being written is skipped and everything before it is kept. Each `assistant/message` event with a usage block counts once, keyed by the session id and the message id, and labelled with the model the event reports. Prompts, replies, tool output, working directories and session titles are never read into records.
- **Cursor:** not counted. Cursor keeps per message token counts at zero in its local database and only stores context window estimates, so there is nothing exact to read.

## What is uploaded

Exactly these fields per record, and nothing else:

| Field | Example |
| --- | --- |
| `source` | `claude-code`, `codex`, `gemini-cli`, `antigravity`, `opencode`, `kimi-code`, `qwen-code`, `copilot-cli`, `cline`, `roo-code`, `kilo-code`, `zcode`, `zed`, `devin`, `deepseek-harness` or `vscode` |
| `recordId` | the tool's own id for the call: the Claude message and request id, the Codex session id and line number, the Gemini session and message id, the Antigravity conversation and response id, the OpenCode or Kilo message id, the Kimi Code session, agent and line or the kimi-cli message id, a hash of the Copilot session, row and time, the Qwen message id, the Cline or Roo task and request time, the ZCode request id, the Zed thread and message id, a hash of the Devin session, step and time, the DeepSeek Harness session and message id, or the VS Code session and turn id |
| `model` | `claude-opus-5-5` |
| `occurredAt` | `2026-11-03T10:15:00.000Z` |
| `inputTokens` | uncached input tokens |
| `outputTokens` | output tokens |
| `cacheReadTokens` | cached input tokens read |
| `cacheWriteTokens` | input tokens written to cache |
| `reasoningTokens` | reasoning tokens, already included in output |

Never uploaded: prompts, responses, code, tool output, working directories, file paths, project names, git branches or session titles. A test in this repository checks that the upload payload contains only the fields above.

Each sync asks the server for your latest record per source and sends records from 48 hours before that point onward. The server ignores records it already has. When a new CLI version changes which records are counted, for example by reading a new source or older compressed logs, the next sync sends every local record once so older calls are not missed, then goes back to the 48 hour window. The file `sync-state.json` next to your config remembers that this happened. It holds only your handle and a version number.

## Privacy

- Run `tokenaires scan` any time to see exactly what would be counted, with no network access.
- Your login lives in `$XDG_CONFIG_HOME/tokenaires/config.json` (default `~/.config/tokenaires/config.json`), readable only by you (file mode 0600, folder 0700). It holds the API address, your access token, the device id, the device private key and your handle.
- `tokenaires logout` revokes the device token on the server and deletes that file.
- To make repeat scans fast, the CLI keeps a scan cache next to the config file at `scan-cache.json.gz`, with the same file permissions. For each log file it stores the local path, size and modification time, and the numeric records that would be uploaded (record id, model, time and token counts). It never stores prompts, responses or file contents, and the paths in it are never uploaded. A file that changes is read again, the cache is rebuilt on each new CLI version, and deleting the file is always safe. Set `TOKENAIRES_NO_CACHE=1` to turn it off.
- SQLite databases are opened read only in immutable mode, so the CLI never writes to them or creates journal files next to them. When a small database has recent changes still in its write ahead log, the database and log are copied to a private temporary folder, read there and deleted.

## Anti tamper

- At login the CLI creates an Ed25519 key pair for this device. Only the public key is sent to the server. The private key stays in your config file.
- Every upload is signed. The signed message is the timestamp, a dot, and the SHA-256 of the exact request body. The server checks the signature, the device and the timestamp, so a batch cannot be altered or replayed later.
- Record ids come from the agents' own logs, so the same call cannot be counted twice or claimed by two accounts.
- The server also rejects records dated in the future, records older than the agent or model, and implausible token ratios. The sync summary lists each rejection reason.

## Configuration

| Variable | Default |
| --- | --- |
| `TOKENAIRES_API_URL` | `https://tokenaires.cc/api/v1` |
| `TOKENAIRES_WEB_URL` | `https://tokenaires.cc` |
| `TOKENAIRES_NO_BROWSER` | unset. Set it to skip opening the browser at login. |
| `XDG_CONFIG_HOME` | `~/.config` |
| `CLAUDE_CONFIG_DIR` | unset. Claude config folders, separated by commas or the path separator. |
| `CODEX_HOME` | `~/.codex` |
| `GEMINI_CLI_HOME` | your home folder |
| `OPENCODE_DATA_DIR` | `$XDG_DATA_HOME/opencode` |
| `OPENCODE_DB_PREFIX` | `opencode` |
| `XDG_DATA_HOME` | `~/.local/share` |
| `ZED_HOME` | unset. Zed data folder, or the folder holding `threads.db`. |
| `VSCODE_DATA_DIR` | unset. VS Code configuration folder, or the folder holding `agentSessionData`. |
| `DEVIN_SESSIONS_DIR` | unset. Devin CLI data folder, or the folder holding its `transcripts`. |
| `DSH_HOME` | `~/.dsh` |
| `TOKENAIRES_NO_CACHE` | unset. Set it to scan without the local scan cache. |

For local development against the backend:

```sh
TOKENAIRES_API_URL=http://localhost:7020/api/v1 TOKENAIRES_WEB_URL=http://localhost:7021 node dist/cli.js
```

## Development

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node dist/cli.js scan
```

The build is a single self contained file at `dist/cli.js`. The Node built ins `node:sqlite` and `node:zlib` are used as is.

## Credits

Some of the log reading rules, such as how forked Codex sessions replay their parent's history and how Antigravity stores usage, were learned from [codeburn](https://github.com/getagentseal/codeburn) (MIT). See `THIRD_PARTY_NOTICES.md`.
