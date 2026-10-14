import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { generate, parseAgent, parseConfig } from "./lib.ts";
import { init } from "./init.ts";
import { migrate, sync } from "./sync.ts";

const AGENT = `---\nname: reviewer\ndescription: Reviews code.\n---\n\nBe strict. Use "quotes" and \\ backslashes.\n`;

function project(config = "agents:\n  reviewer:\n    claude: { model: sonnet }\n    codex: { model: gpt-5.3-codex, sandbox_mode: read-only }\n") {
  const root = mkdtempSync(join(tmpdir(), "agents-"));
  mkdirSync(join(root, "subagentsync/agents"), { recursive: true });
  writeFileSync(join(root, "subagentsync/agents/reviewer.md"), AGENT);
  writeFileSync(join(root, "subagentsync/config.yaml"), config);
  return root;
}

test("parseAgent validates frontmatter", () => {
  assert.equal(parseAgent(AGENT, "x").name, "reviewer");
  assert.throws(() => parseAgent("no frontmatter", "x"), /missing YAML frontmatter/);
  assert.throws(() => parseAgent("---\nname: Bad Name\ndescription: d\n---\nbody", "x"), /lowercase/);
  assert.throws(() => parseAgent("---\nname: a\ndescription: d\nmodel: x\n---\nbody", "x"), /unknown frontmatter keys: model/);
  assert.throws(() => parseAgent(AGENT, "x", "other"), /must match the filename/);
});

test("parseConfig rejects unsupported settings and unknown agents", () => {
  assert.throws(() => parseConfig("agents:\n  reviewer:\n    cursor: { sandbox_mode: read-only }\n", ["reviewer"]), /not supported by cursor/);
  assert.throws(() => parseConfig("agents:\n  ghost:\n    claude: {}\n", ["reviewer"]), /no definition/);
  assert.throws(() => parseConfig("agents:\n  reviewer:\n    claude: { tools: Read }\n", ["reviewer"]), /expected string\[\]/);
  assert.throws(() => parseConfig("agents:\n  reviewer:\n    vim: {}\n", ["reviewer"]), /unknown platform/);
});

test("generate emits platform-specific output with shared text", () => {
  const agent = parseAgent(AGENT, "x");
  const claude = generate(agent, "claude", { model: "sonnet", tools: ["Read", "Grep"] });
  assert.match(claude, /^---\nname: reviewer\ndescription: Reviews code\.\nmodel: sonnet\ntools: Read, Grep\n---/);
  assert.match(claude, /AUTO-GENERATED/);
  const cursor = generate(agent, "cursor", { readonly: true });
  assert.match(cursor, /readonly: true/);
  assert.doesNotMatch(cursor, /sandbox_mode/);
  const codex = generate(agent, "codex", { model: "gpt-5.3-codex", sandbox_mode: "read-only" });
  assert.match(codex, /^# AUTO-GENERATED/);
  assert.match(codex, /model = "gpt-5.3-codex"\nsandbox_mode = "read-only"\ndeveloper_instructions = """/);
  assert.ok(codex.includes('Use "quotes" and \\\\ backslashes.'));
});

test("sync is idempotent and check detects drift without writing", () => {
  const root = project();
  try {
    assert.equal(sync(root, false).changes.length, 3); // check mode: nothing written
    assert.equal(existsSync(join(root, ".claude")), false);
    sync(root, true);
    const before = readFileSync(join(root, ".codex/agents/reviewer.toml"), "utf8");
    assert.match(before, /model = "gpt-5.3-codex"/);
    assert.deepEqual(sync(root, true).changes, []);
    assert.equal(readFileSync(join(root, ".codex/agents/reviewer.toml"), "utf8"), before);

    writeFileSync(join(root, "subagentsync/config.yaml"), "agents:\n  reviewer:\n    claude: { model: opus }\n    codex: { enabled: false }\n");
    const drift = sync(root, false).changes;
    assert.deepEqual(drift, ["update .claude/agents/reviewer.md", "delete .codex/agents/reviewer.toml"]);
    sync(root, true);
    assert.match(readFileSync(join(root, ".claude/agents/reviewer.md"), "utf8"), /model: opus/);
    assert.equal(existsSync(join(root, ".codex/agents/reviewer.toml")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sync refuses to overwrite unmanaged files and never deletes them", () => {
  const root = project();
  try {
    mkdirSync(join(root, ".cursor/agents"), { recursive: true });
    writeFileSync(join(root, ".cursor/agents/reviewer.md"), "---\nname: reviewer\n---\nhand written\n");
    writeFileSync(join(root, ".cursor/agents/other.md"), "mine");
    const r = sync(root, true);
    assert.match(r.errors[0], /not generated/);
    assert.equal(readFileSync(join(root, ".cursor/agents/reviewer.md"), "utf8").includes("hand written"), true);
    assert.equal(readFileSync(join(root, ".cursor/agents/other.md"), "utf8"), "mine");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migrate moves unmanaged agents into agents/ and config, keeping originals in legacy/", () => {
  const root = mkdtempSync(join(tmpdir(), "agents-"));
  try {
    mkdirSync(join(root, ".claude/agents"), { recursive: true });
    mkdirSync(join(root, ".codex/agents"), { recursive: true });
    writeFileSync(join(root, ".claude/agents/helper.md"), "---\nname: helper\ndescription: Helps.\nmodel: haiku\ntools: Read, Grep\nsynced_at: now\n---\nHelp people.\n");
    writeFileSync(join(root, ".codex/agents/scribe.md"), "---\nname: scribe\ndescription: Writes.\nmodel: claude-opus-5-5\n---\nWrite.\n");
    const { log } = migrate(root);
    assert.match(log.join("\n"), /not carried over \(unsupported by claude\): synced_at/);
    assert.equal(readFileSync(join(root, "subagentsync/agents/helper.md"), "utf8"), "---\nname: helper\ndescription: Helps.\n---\n\nHelp people.\n");
    const config = readFileSync(join(root, "subagentsync/config.yaml"), "utf8");
    assert.match(config, /model: haiku/);
    assert.match(config, /- Read\n/);
    assert.doesNotMatch(config, /opus/); // codex .md model is not a valid codex model
    assert.ok(existsSync(join(root, "subagentsync/legacy/.claude/agents/helper.md")));
    assert.equal(sync(root, true).errors.length, 0);
    assert.match(readFileSync(join(root, ".claude/agents/helper.md"), "utf8"), /tools: Read, Grep/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("init creates the data folder, generates all platforms, and refuses to run twice", () => {
  const root = mkdtempSync(join(tmpdir(), "agents-"));
  try {
    const { created, result } = init(root);
    assert.equal(result.errors.length, 0);
    assert.equal(created.length, 3);
    for (const f of [".claude/agents/code-reviewer.md", ".cursor/agents/code-reviewer.md", ".codex/agents/code-reviewer.toml"]) {
      assert.ok(existsSync(join(root, f)), f);
    }
    assert.deepEqual(sync(root, false).changes, []);
    assert.throws(() => init(root), /already exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
