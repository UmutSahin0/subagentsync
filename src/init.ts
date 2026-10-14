import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, sync } from "./sync.ts";
import type { Result } from "./sync.ts";

const EXAMPLE_AGENT = `---
name: code-reviewer
description: Reviews code for correctness, security and maintainability. Use after code changes.
---

You are an expert code reviewer.

Focus on correctness, security, performance and maintainability.
Lead with concrete findings, ordered by severity, with file and line.
If the code looks good, say so briefly instead of inventing issues.
`;

const EXAMPLE_CONFIG = `# Per-platform settings for each agent in ${DATA_DIR}/agents/<name>.md.
# Only listed fields are emitted; omitted fields use the platform default.
#
#   claude: model, tools, disallowedTools, permissionMode, effort, color, maxTurns
#   cursor: model, readonly, is_background
#   codex:  model, model_reasoning_effort, sandbox_mode
#   any:    enabled: false  -> skip this agent on that platform
agents:
  code-reviewer:
    claude: { model: sonnet }
    cursor: { model: inherit }
    codex: {}   # e.g. { model: gpt-5.3-codex, sandbox_mode: read-only }
`;

const README = `# subagentsync

Define each subagent once in \`agents/<name>.md\`, choose models per tool in \`config.yaml\`, then run:

    npx subagentsync sync

This generates \`.claude/agents/*.md\`, \`.cursor/agents/*.md\` and \`.codex/agents/*.toml\`.
Do not edit the generated files; edit the files in this folder instead.

- Add an agent: create \`agents/<name>.md\` with \`name\` and \`description\` frontmatter, then sync.
- Change a model: edit the agent's entry in \`config.yaml\`, then sync.
- Validate (CI): \`npx subagentsync check\`
- Import agents you already wrote by hand: \`npx subagentsync migrate\`

Docs: https://github.com/UmutSahin0/subagentsync
`;

/** Create subagentsync/ with an example agent and config, then generate the platform files. */
export function init(root: string): { created: string[]; result: Result } {
  const dir = join(root, DATA_DIR);
  if (existsSync(dir)) throw new Error(`${DATA_DIR}/ already exists; nothing was changed. Run \`npx subagentsync sync\` instead.`);
  mkdirSync(join(dir, "agents"), { recursive: true });
  writeFileSync(join(dir, "agents", "code-reviewer.md"), EXAMPLE_AGENT);
  writeFileSync(join(dir, "config.yaml"), EXAMPLE_CONFIG);
  writeFileSync(join(dir, "README.md"), README);
  const created = [`${DATA_DIR}/agents/code-reviewer.md`, `${DATA_DIR}/config.yaml`, `${DATA_DIR}/README.md`];
  return { created, result: sync(root, true) };
}
