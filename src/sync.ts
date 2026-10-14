import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { CAPABILITIES, PLATFORMS, generate, isGenerated, outputPath, parseAgent, parseConfig, serializeAgent, splitFrontmatter } from "./lib.ts";
import type { Agent, Config, Platform } from "./lib.ts";

export const DATA_DIR = "subagentsync";
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const mdFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);

export interface Result {
  errors: string[];
  changes: string[]; // human-readable: "create x", "update x", "delete x"
}

export function loadAgents(root: string): Agent[] {
  return mdFiles(join(root, DATA_DIR, "agents")).map((f) => parseAgent(read(join(root, DATA_DIR, "agents", f)), `${DATA_DIR}/agents/${f}`, basename(f, ".md")));
}

export function loadConfig(root: string, names: string[]): Config {
  const p = join(root, DATA_DIR, "config.yaml");
  return existsSync(p) ? parseConfig(read(p), names) : {};
}

/** Sync (apply = true) or check (apply = false) generated files. */
export function sync(root: string, apply: boolean): Result {
  const result: Result = { errors: [], changes: [] };
  let agents: Agent[];
  let config: Config;
  try {
    agents = loadAgents(root);
    config = loadConfig(root, agents.map((a) => a.name));
  } catch (e) {
    result.errors.push((e as Error).message);
    return result;
  }

  const wanted = new Map<string, string>();
  for (const agent of agents) {
    for (const platform of PLATFORMS) {
      const settings = config[agent.name]?.[platform];
      if (settings?.enabled === false) continue;
      wanted.set(outputPath(platform, agent.name), generate(agent, platform, settings));
    }
  }

  for (const [rel, content] of wanted) {
    const abs = join(root, rel);
    const current = existsSync(abs) ? read(abs) : null;
    if (current === content) continue;
    if (current !== null && !isGenerated(current)) {
      result.errors.push(`${rel}: exists but is not generated (no AUTO-GENERATED marker); refusing to overwrite. Move it away or run "npx subagentsync migrate".`);
      continue;
    }
    result.changes.push(`${current === null ? "create" : "update"} ${rel}`);
    if (apply) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  }

  // Stale generated files (agent removed or platform disabled). Unmarked files are never touched.
  for (const platform of PLATFORMS) {
    const dir = join(root, `.${platform}`, "agents");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      const rel = `.${platform}/agents/${f}`;
      if (wanted.has(rel) || !/\.(md|toml)$/.test(f) || !isGenerated(read(join(dir, f)))) continue;
      result.changes.push(`delete ${rel}`);
      if (apply) rmSync(join(dir, f));
    }
  }
  return result;
}

/** Move unmanaged agents from .claude/.cursor/.codex into subagentsync/agents/ + subagentsync/config.yaml. Originals go to legacy/. */
export function migrate(root: string): { log: string[] } {
  const log: string[] = [];
  const configPath = join(root, DATA_DIR, "config.yaml");
  const doc = parseDocument(existsSync(configPath) ? read(configPath) : "agents: {}\n");
  mkdirSync(join(root, DATA_DIR, "agents"), { recursive: true });

  for (const platform of PLATFORMS) {
    const dir = join(root, `.${platform}`, "agents");
    for (const f of mdFiles(dir)) {
      const src = join(dir, f);
      const text = read(src);
      if (isGenerated(text)) continue;
      const name = basename(f, ".md");
      const { data, body } = splitFrontmatter(text, src);
      const agent = parseAgent(serializeAgent({ name, description: String(data.description ?? ""), body }), src);

      const target = join(root, DATA_DIR, "agents", `${name}.md`);
      if (existsSync(target)) {
        if (read(target) !== serializeAgent(agent)) log.push(`! ${src}: ${DATA_DIR}/agents/${name}.md already exists with different content; kept existing, original moved to ${DATA_DIR}/legacy/`);
      } else {
        writeFileSync(target, serializeAgent(agent));
        log.push(`+ ${DATA_DIR}/agents/${name}.md (from .${platform}/agents/${f})`);
      }

      // Codex .md files were never a valid Codex format, so their model can't be trusted.
      const caps = CAPABILITIES[platform];
      const kept: string[] = [];
      const dropped: string[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (k === "name" || k === "description") continue;
        if (platform !== "codex" && k in caps) {
          const value = k === "tools" || k === "disallowedTools" ? (Array.isArray(v) ? v : String(v).split(/\s*,\s*/)) : v;
          doc.setIn(["agents", name, platform, k], value);
          kept.push(k);
        } else dropped.push(k);
      }
      if (kept.length) log.push(`  config: agents.${name}.${platform}: ${kept.join(", ")}`);
      if (dropped.length) log.push(`  not carried over (unsupported by ${platform}): ${dropped.join(", ")}`);

      const legacy = join(root, DATA_DIR, "legacy", `.${platform}`, "agents", f);
      mkdirSync(dirname(legacy), { recursive: true });
      renameSync(src, legacy);
    }
  }
  writeFileSync(configPath, doc.toString({ collectionStyle: "block" }));
  return { log };
}
