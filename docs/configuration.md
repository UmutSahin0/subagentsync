# Configuration reference

This page lists everything you can put in `subagentsync/agents/<name>.md` and `subagentsync/config.yaml`, and what each platform does with it.

## Agent definition: `subagentsync/agents/<name>.md`

```md
---
name: reviewer
description: Reviews code for correctness and security. Use after code changes.
---

You are an expert code reviewer.
...
```

| Field | Required | Rules |
|---|---|---|
| `name` | yes | Lowercase letters, digits and hyphens (`^[a-z0-9][a-z0-9-]*$`). Must match the filename. |
| `description` | yes | One line. Every tool uses it to decide **when** to delegate to the agent, so say when to use it as well as what it does. |
| body | yes | The system prompt. Becomes the Markdown body for Claude Code and Cursor, and `developer_instructions` for Codex. |

No other frontmatter keys are allowed. Models and permissions are platform-specific and go in `subagentsync/config.yaml`.

## Platform settings: `subagentsync/config.yaml`

```yaml
agents:
  <agent-name>:
    claude: { ... }
    cursor: { ... }
    codex:  { ... }
```

- All sections are optional. A missing agent or platform means "use that platform's defaults".
- `enabled: false` under any platform skips generating the agent for that platform. If the file was generated earlier, it is deleted.
- The validator checks **field names and types**. It does not check enum values such as model names, because these change faster than this tool. Check the platform's docs for the values your version accepts.

### Claude Code → `.claude/agents/<name>.md`

| Setting | Type | Values | Default when omitted |
|---|---|---|---|
| `model` | string | `sonnet`, `opus`, `haiku`, `inherit`, or a full model ID such as `claude-opus-5-5` | `inherit` (the generator always writes it) |
| `tools` | list of strings | Tool names, e.g. `[Read, Grep, Glob, Bash]` | All tools available to subagents |
| `disallowedTools` | list of strings | Tool names to remove, e.g. `[Write, Edit]` | None |
| `permissionMode` | string | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` | Session mode |
| `effort` | string | `low`, `medium`, `high`, `xhigh`, `max` (availability depends on the model) | Model default |
| `color` | string | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` | Automatic |
| `maxTurns` | number | e.g. `20` | No limit |

`tools` and `disallowedTools` must be YAML lists in the config (`[Read, Grep]`). They are written as a comma-separated string, the form Claude Code documents.

```yaml
code-reviewer:
  claude:
    model: opus
    tools: [Read, Grep, Glob, Bash]
    effort: high
    color: red
```

Reference: [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)

### Cursor → `.cursor/agents/<name>.md`

| Setting | Type | Values | Default when omitted |
|---|---|---|---|
| `model` | string | `inherit`, or a model ID (e.g. `composer-2`, optionally with options like `claude-opus-5[effort=high]`) | `inherit` |
| `readonly` | boolean | `true` blocks file edits and state-changing shell commands | `false` |
| `is_background` | boolean | `true` runs without blocking the parent agent | `false` |

```yaml
code-reviewer:
  cursor:
    model: inherit
    readonly: true
```

Cursor also reads `.claude/agents/*.md` and `.codex/agents/*.md`. When names collide, `.cursor/agents` wins, so the generated Cursor file is the one Cursor uses.

Reference: [Cursor subagents](https://cursor.com/docs/context/subagents)

### OpenAI Codex → `.codex/agents/<name>.toml`

| Setting | Type | Values | Default when omitted |
|---|---|---|---|
| `model` | string | An OpenAI model ID, e.g. `gpt-5.3-codex` | Parent session's model |
| `model_reasoning_effort` | string | e.g. `low`, `medium`, `high` | Parent session's effort |
| `sandbox_mode` | string | `read-only`, `workspace-write`, `danger-full-access` | Parent session's sandbox |

```yaml
code-reviewer:
  codex:
    model: gpt-5.3-codex
    model_reasoning_effort: high
    sandbox_mode: read-only
```

Notes:

- Each agent is a standalone TOML file and needs no registration in `config.toml`.
- Codex has **no per-agent tool allowlist**. Use `sandbox_mode` to restrict an agent.
- Don't use Claude model IDs here. Codex can't run them.
- `AGENTS.md` (project-wide instructions) is a separate mechanism and is not generated.

Reference: [Codex subagents](https://developers.openai.com/codex/subagents)

## Feature matrix

| Capability | Claude Code | Cursor | Codex |
|---|---|---|---|
| Per-agent model | `model` | `model` | `model` |
| Reasoning effort | `effort` | via model options | `model_reasoning_effort` |
| Read-only agent | `disallowedTools: [Write, Edit]` or `permissionMode: plan` | `readonly: true` | `sandbox_mode: read-only` |
| Tool allowlist | `tools` | — | — |
| Background run | — | `is_background` | — |
| UI colour | `color` | — | — |

## Common errors

| Message | Cause | Fix |
|---|---|---|
| `agents.x.cursor.sandbox_mode: not supported by cursor` | The setting belongs to another platform | Use the platform's equivalent from the matrix above |
| `agents.x.claude.tools: expected string[]` | `tools: Read, Grep` written as a string | Write a list: `tools: [Read, Grep]` |
| `subagentsync/config.yaml: "x" has no definition in subagentsync/agents/x.md` | Config entry without an agent file, or a typo | Create `subagentsync/agents/x.md` or fix the name |
| `subagentsync/agents/x.md: name "y" must match the filename "x"` | Filename and `name` differ | Rename one of them |
| `subagentsync/agents/x.md: unknown frontmatter keys: model` | Platform setting placed in the agent file | Move it to `subagentsync/config.yaml` |
| `.claude/agents/x.md: exists but is not generated` | A hand-written file is in the way | Move it, or run `npx subagentsync migrate` |

## Adding a new setting

All supported settings live in one place, `CAPABILITIES` in [`src/lib.ts`](../src/lib.ts):

```ts
claude: {
  model: "string",
  tools: "string[]",
  // add new Claude Code fields here
},
```

Add the field with its type, add a test, and add a row to this page. See [CONTRIBUTING.md](../CONTRIBUTING.md).
