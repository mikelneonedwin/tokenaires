<a href="https://tokenaires.cc">
  <img src="assets/readme/og.png" alt="Tokenaires, the rich list for AI tokens" width="100%">
</a>

<p align="center">
  <b>The rich list for developers, ranked by the AI tokens they burn.</b><br>
  Claude Code · Codex · Gemini CLI · Antigravity · OpenCode · Kimi Code · Qwen Code · Copilot CLI · Cline · Roo Code · Kilo Code · ZCode · Zed · Devin · DeepSeek Harness · VS Code
</p>

<p align="center">
  <a href="https://tokenaires.cc"><img src="https://img.shields.io/badge/see_the_list-tokenaires.cc-bef264?style=for-the-badge&labelColor=09090b" alt="See the list on tokenaires.cc"></a>
  <a href="https://www.npmjs.com/package/tokenaires"><img src="https://img.shields.io/npm/v/tokenaires?style=for-the-badge&label=npm&color=bef264&labelColor=09090b" alt="npm version"></a>
  <a href="https://github.com/appdever01/tokenaires/stargazers"><img src="https://img.shields.io/badge/github-%E2%98%85_star-bef264?style=for-the-badge&logo=github&logoColor=white&labelColor=09090b" alt="Star on GitHub"></a>
</p>

## Join in one command

```sh
npx tokenaires
```

<img src="assets/readme/terminal.svg" alt="npx tokenaires signs you in with GitHub, scans your agent logs, uploads token counts and shows your rank" width="100%">

Want to look first? `npx tokenaires scan` prints your totals locally and sends nothing.

## How it works

|     | Step | What happens |
| :-: | --- | --- |
| **1** | **Sign in** | Approve a short code on GitHub. Your public profile becomes your name and avatar. |
| **2** | **Scan** | The CLI reads the usage logs your agents already keep on your machine. |
| **3** | **Rank** | Token counts are uploaded, the server adds them up and you land on the list. |

**Tiers:** Thousandaire at 1K, Millionaire at 1M, Billionaire at 1B, Trillionaire at 1T.

## What leaves your machine

| Sent | Never sent |
| --- | --- |
| Tool, message ID, model and time | Prompts and replies |
| Input, output and cache token counts | Code and tool output |
| | File paths, project and branch names |

The full field list is in the [CLI README](https://github.com/appdever01/tokenaires/tree/cli#what-is-uploaded).

## Keeping it honest

- The server computes every total. The CLI only sends raw records.
- Each message ID can belong to one account, so copied logs get flagged.
- Uploads are signed by a key that stays on your device, and each signature works once.
- Impossible timestamps, models and token ratios are refused. Unusual spikes go to review.

## Commands

| Command | What it does |
| --- | --- |
| `npx tokenaires` | Sign in if needed, then sync |
| `tokenaires scan` | Show local totals, upload nothing |
| `tokenaires status` | Your rank and progress to the next tier |
| `tokenaires schedule on` | Sync automatically every 6 hours |
| `tokenaires logout` | Remove the saved login and device key |

Needs Node.js 22.15 or newer.

---

<p align="center">
  <b>Like it? A star helps more developers find the list.</b><br><br>
  <a href="https://github.com/appdever01/tokenaires/stargazers"><img src="https://img.shields.io/badge/%E2%98%85_star_tokenaires_on_github-bef264?style=for-the-badge&logo=github&logoColor=09090b" alt="Star Tokenaires on GitHub"></a>
</p>

---

<details>
<summary><b>For contributors: repository layout and local setup</b></summary>

<br>

`main` holds this overview. Each part lives on its own branch and is cloned into a folder of the same name.

| Branch | Contents | Local address |
| --- | --- | --- |
| [`frontend`](https://github.com/appdever01/tokenaires/tree/frontend) | Next.js 16 site: board, top three, profiles | http://localhost:7021 |
| [`backend`](https://github.com/appdever01/tokenaires/tree/backend) | NestJS 11 API, PostgreSQL, Drizzle, shared contracts | http://localhost:7020/api/v1 |
| [`cli`](https://github.com/appdever01/tokenaires/tree/cli) | The `tokenaires` npm package | none |

```sh
git clone --branch main --single-branch https://github.com/appdever01/tokenaires.git tokenaires
cd tokenaires
git clone --branch backend --single-branch https://github.com/appdever01/tokenaires.git backend
git clone --branch frontend --single-branch https://github.com/appdever01/tokenaires.git frontend
git clone --branch cli --single-branch https://github.com/appdever01/tokenaires.git cli
```

Requires Node.js 22.15 or newer, pnpm and PostgreSQL 16 or newer.

```sh
cd backend && pnpm install && cp .env.example .env && createdb tokenaires && pnpm db:migrate && pnpm start:dev
cd frontend && pnpm install && cp .env.example .env.local && pnpm dev
cd cli && pnpm install && pnpm build && TOKENAIRES_API_URL=http://localhost:7020/api/v1 node dist/cli.js
```

Each folder is its own Git repository with its own README, dependencies and checks.

</details>

## License

MIT
