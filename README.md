<div align="center">

# subagentsync

**Write your AI subagents once. Use them in Claude Code, Cursor and OpenAI Codex.**

One Markdown file per agent → native subagent configs for every AI coding tool, with a different model per tool.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Dependencies: 1](https://img.shields.io/badge/dependencies-1-brightgreen)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-orange.svg)](CONTRIBUTING.md)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Umut%20%C5%9Eahin-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/umutsahinn1/)
[![Medium](https://img.shields.io/badge/Medium-Blog-000000?logo=medium&logoColor=white)](https://medium.com/@umutsahinn1)

</div>

---

## The problem

Claude Code, Cursor and OpenAI Codex all support **subagents** (specialised AI assistants such as a code reviewer or a debugger that the main agent delegates to). Each tool stores them differently:

| Tool | Location | Format |
|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | Markdown + YAML frontmatter (`tools`, `model: sonnet`, `permissionMode`, ...) |
| Cursor | `.cursor/agents/<name>.md` | Markdown + YAML frontmatter (`readonly`, `is_background`, ...) |
| OpenAI Codex | `.codex/agents/<name>.toml` | TOML (`developer_instructions`, `sandbox_mode`, `model_reasoning_effort`, ...) |

If your team uses more than one of these tools, you end up copying the same prompt into three places. The copies drift apart, and each tool needs its own model names anyway (`opus` in Claude, `gpt-5.3-codex` in Codex).

## The solution

**Define once, configure per platform, generate automatically.**

```text
subagentsync/agents/reviewer.md ─┐                        ┌─▶ .claude/agents/reviewer.md
                                     ├─▶ npx subagentsync ├─▶ .cursor/agents/reviewer.md
subagentsync/config.yaml        ─┘          sync          └─▶ .codex/agents/reviewer.toml
```

- **Single source of truth.** The name, description and instructions live in one Markdown file.
- **A model per platform.** `opus` for Claude, `inherit` for Cursor and `gpt-5.3-codex` for Codex, all for the same agent.
- **Native output.** Each tool gets the format it reads, including Codex TOML. Nothing is emulated.
- **Strict validation.** A setting a platform doesn't support (for example `sandbox_mode` on Cursor) is an error, never emitted silently.
- **Safe.** Only files the generator created (marked `AUTO-GENERATED`) are overwritten or deleted. Hand-written files are left alone.
- **CI-ready.** `npx subagentsync check` fails when generated files are out of date and changes nothing.
- **Nothing added to your project's code.** It writes one data folder (`subagentsync/`) plus the generated agent files. No scripts to copy, no dependency to add.

## Quick start

Run this in the root of any project:

```bash
npx subagentsync init
```

```text
create subagentsync/agents/code-reviewer.md
create subagentsync/config.yaml
create subagentsync/README.md
create .claude/agents/code-reviewer.md
create .cursor/agents/code-reviewer.md
create .codex/agents/code-reviewer.toml
```

That's it: the example `code-reviewer` subagent is already available in Claude Code, Cursor and Codex. From here you only edit files in `subagentsync/` and run `npx subagentsync sync`.

### 1. Write an agent: `subagentsync/agents/reviewer.md`

```md
---
name: reviewer
description: Reviews code for correctness, security and maintainability. Use after code changes.
---

You are an expert code reviewer.

Focus on correctness, security, performance and maintainability.
Lead with concrete findings, ordered by severity, with file and line.
```

### 2. Pick models per platform: `subagentsync/config.yaml`

```yaml
agents:
  reviewer:
    claude: { model: sonnet, tools: [Read, Grep, Glob], effort: high }
    cursor: { model: inherit, readonly: true }
    codex:  { model: gpt-5.3-codex, model_reasoning_effort: high, sandbox_mode: read-only }
```

This step is optional. Without a config entry every platform inherits the model of the current session.

### 3. Generate

```bash
npx subagentsync sync
```

<details>
<summary>See the generated files</summary>

`.claude/agents/reviewer.md`

```md
---
name: reviewer
description: Reviews code for correctness, security and maintainability. Use after code changes.
model: sonnet
tools: Read, Grep, Glob
effort: high
---

<!-- AUTO-GENERATED from subagentsync/agents/reviewer.md + subagentsync/config.yaml. Do not edit; run `npx subagentsync sync`. -->

You are an expert code reviewer.
...
```

`.codex/agents/reviewer.toml`

```toml
# AUTO-GENERATED from subagentsync/agents/reviewer.md + subagentsync/config.yaml. Do not edit; run `npx subagentsync sync`.
name = "reviewer"
description = "Reviews code for correctness, security and maintainability. Use after code changes."
model = "gpt-5.3-codex"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
You are an expert code reviewer.
...
"""
```

</details>

Open the project in Claude Code, Cursor or Codex and the `reviewer` subagent is available. Commit the generated folders so teammates get the agents without running anything.

## Commands

Run them from your project root.

| Command | What it does |
|---|---|
| `npx subagentsync init` | Creates `subagentsync/` with an example agent and config, then generates the platform files. Refuses to run if the folder exists. |
| `npx subagentsync sync` | Generates or updates every platform file. Deletes generated files for agents you removed. |
| `npx subagentsync check` | Validates config and reports out-of-date files. Writes nothing. Exits `1` on problems, so it fits CI. |
| `npx subagentsync migrate` | Imports hand-written agents from `.claude/`, `.cursor/` or `.codex/agents/*.md` into `subagentsync/`. Originals are moved to `subagentsync/legacy/`, never deleted. |

Prefer a local install? `npm install -D subagentsync`, then `npx subagentsync sync` or an npm script (`"agents:sync": "subagentsync sync"`).

## Supported settings

| Platform | Settings you can set in `subagentsync/config.yaml` |
|---|---|
| Claude Code | `model`, `tools`, `disallowedTools`, `permissionMode`, `effort`, `color`, `maxTurns` |
| Cursor | `model`, `readonly`, `is_background` |
| Codex | `model`, `model_reasoning_effort`, `sandbox_mode` |
| All | `enabled: false` skips the agent on that platform |

Allowed values and examples are in **[docs/configuration.md](docs/configuration.md)**.

## What gets created in your project

```text
your-project/
├── subagentsync/          # ✏️  You edit this
│   ├── agents/                #     one <name>.md per agent
│   ├── config.yaml            #     per-platform model and settings
│   └── README.md              #     short how-to
├── .claude/agents/            # ⚙️  Generated (Claude Code)
├── .cursor/agents/            # ⚙️  Generated (Cursor)
└── .codex/agents/             # ⚙️  Generated (OpenAI Codex)
```

## Repository structure (this project)

```text
subagentsync/                  # the tool itself
├── src/
│   ├── cli.ts                     # Commands: init, sync, check, migrate
│   ├── init.ts                    # Scaffolding for `init`
│   ├── sync.ts                    # Sync, check and migrate logic
│   ├── lib.ts                     # Parsing, validation, per-platform generation
│   └── sync.test.ts               # Tests
├── subagentsync/              # This repo uses its own tool (dogfooding)
├── docs/configuration.md          # Every setting and its allowed values
├── .github/                       # Issue and PR templates, CI workflow
├── CONTRIBUTING.md
└── LICENSE
```

## FAQ

**How do I share the same subagents between Claude Code, Cursor and Codex?**
Run `npx subagentsync init`, put each agent in `subagentsync/agents/<name>.md` and run `npx subagentsync sync`. That generates `.claude/agents/*.md`, `.cursor/agents/*.md` and `.codex/agents/*.toml` from the same source.

**Can one agent use Claude Opus in Claude Code and a GPT model in Codex?**
Yes. That is what `config.yaml` is for: `claude: { model: opus }` and `codex: { model: gpt-5.3-codex }` on the same agent.

**Is `AGENTS.md` the same as a Codex subagent?**
No. `AGENTS.md` holds project-wide instructions for the main agent. Codex custom agents are standalone TOML files in `.codex/agents/` with `name`, `description` and `developer_instructions`. This tool generates the TOML files and does not touch `AGENTS.md`.

**Cursor already reads `.claude/agents`. Why generate `.cursor/agents` too?**
Cursor-only settings such as `readonly` and `is_background` and a Cursor-specific model can only go in Cursor's own files. When names collide, `.cursor/agents` takes precedence.

**Will it overwrite my hand-written agent files?**
No. Files without the `AUTO-GENERATED` marker are never overwritten or deleted. A conflict is reported as an error.

**I already have agents in `.claude/agents`. Can I adopt them?**
Yes, run `npx subagentsync migrate`. It copies them into `subagentsync/agents/`, moves their model and tool settings into `config.yaml`, and moves the originals to `subagentsync/legacy/`.

**Why can't I set `tools` for Codex?**
Codex custom agents have no per-agent tool allowlist. Use `sandbox_mode: read-only` to restrict them. The generator rejects settings a platform doesn't support instead of emitting something the platform would ignore.

## Roadmap

- [x] Published CLI: `npx subagentsync init`
- [ ] Interactive import of existing agents, with duplicate resolution across tools
- [ ] More Claude Code fields: `skills`, `mcpServers`, `memory`, `isolation`
- [ ] Optional generation of `AGENTS.md` sections
- [ ] Watch mode (`sync --watch`)

Ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

Issues labelled **good first issue** are a good place to start. The codebase is small enough to read in about 15 minutes. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions and how to add support for a new setting.

## Author

**Umut Şahin**

- LinkedIn: [linkedin.com/in/umutsahinn1](https://www.linkedin.com/in/umutsahinn1/)
- Medium: [medium.com/@umutsahinn1](https://medium.com/@umutsahinn1)
- GitHub: [github.com/UmutSahin0](https://github.com/UmutSahin0)

If this saves you some copy-pasting, a ⭐ on GitHub helps others find it.

## License

[MIT](LICENSE)
