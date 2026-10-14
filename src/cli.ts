#!/usr/bin/env node
import { init } from "./init.ts";
import { migrate, sync } from "./sync.ts";

const HELP = `subagentsync: define AI subagents once, generate Claude Code, Cursor and Codex configs.

Usage: subagentsync <command>

Commands:
  init      Create ./subagentsync/ with an example agent and config, then generate files
  sync      Generate .claude/, .cursor/ and .codex/ agent files from ./subagentsync/
  check     Validate config and fail if generated files are out of date (writes nothing)
  migrate   Import hand-written agents from .claude/.cursor/.codex into ./subagentsync/

Run it from the root of your project.
`;

function main(): number {
  const [command] = process.argv.slice(2);
  const root = process.cwd();

  switch (command) {
    case "init": {
      const { created, result } = init(root);
      for (const f of created) console.log(`create ${f}`);
      for (const c of result.changes) console.log(c);
      for (const e of result.errors) console.error(`error: ${e}`);
      if (!result.errors.length) console.log("\nDone. Edit subagentsync/agents/*.md, then run `npx subagentsync sync`.");
      return result.errors.length ? 1 : 0;
    }
    case "sync":
    case "check": {
      const check = command === "check";
      const { errors, changes } = sync(root, !check);
      for (const e of errors) console.error(`error: ${e}`);
      for (const c of changes) console.log(check ? `out of sync: ${c}` : c);
      if (check && changes.length) console.error("Run `npx subagentsync sync` to fix.");
      if (errors.length || (check && changes.length)) return 1;
      console.log(check ? "ok: generated files are up to date" : changes.length ? "synced" : "already up to date");
      return 0;
    }
    case "migrate": {
      console.log(migrate(root).log.join("\n") || "nothing to migrate");
      return 0;
    }
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return 0;
    default:
      console.error(`unknown command: ${command}\n\n${HELP}`);
      return 1;
  }
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`error: ${(e as Error).message}`);
  process.exitCode = 1;
}
