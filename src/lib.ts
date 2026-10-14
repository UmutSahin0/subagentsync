import { parse, stringify } from "yaml";

export const PLATFORMS = ["claude", "cursor", "codex"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface Agent {
  name: string;
  description: string;
  body: string;
}

/** Per-platform settings that the generator is allowed to emit. Anything else is a validation error. */
export const CAPABILITIES: Record<Platform, Record<string, "string" | "boolean" | "number" | "string[]">> = {
  claude: {
    model: "string", // sonnet | opus | haiku | inherit | full model id
    tools: "string[]",
    disallowedTools: "string[]",
    permissionMode: "string",
    effort: "string",
    color: "string",
    maxTurns: "number",
  },
  cursor: {
    model: "string", // inherit | fast | model id
    readonly: "boolean",
    is_background: "boolean",
  },
  codex: {
    model: "string",
    model_reasoning_effort: "string",
    sandbox_mode: "string", // read-only | workspace-write | danger-full-access
  },
};

export type PlatformSettings = Record<string, string | boolean | string[] | number>;
export type Config = Record<string, Partial<Record<Platform, PlatformSettings & { enabled?: boolean }>>>;

export const MARKER = "AUTO-GENERATED";
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export function splitFrontmatter(text: string, where: string): { data: Record<string, unknown>; body: string } {
  const m = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${where}: missing YAML frontmatter (--- ... ---)`);
  let data: unknown;
  try {
    data = parse(m[1]);
  } catch (e) {
    throw new Error(`${where}: invalid YAML frontmatter: ${(e as Error).message}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${where}: frontmatter must be a mapping`);
  }
  return { data: data as Record<string, unknown>, body: m[2] };
}

export function parseAgent(text: string, where: string, expectedName?: string): Agent {
  const { data, body } = splitFrontmatter(text, where);
  const { name, description } = data;
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    throw new Error(`${where}: "name" must be lowercase letters, digits and hyphens`);
  }
  if (expectedName && name !== expectedName) {
    throw new Error(`${where}: name "${name}" must match the filename "${expectedName}"`);
  }
  if (typeof description !== "string" || !description.trim()) {
    throw new Error(`${where}: "description" is required`);
  }
  const extra = Object.keys(data).filter((k) => k !== "name" && k !== "description");
  if (extra.length) {
    throw new Error(`${where}: unknown frontmatter keys: ${extra.join(", ")} (platform settings belong in subagentsync/config.yaml)`);
  }
  if (!body.trim()) throw new Error(`${where}: instructions (body) are empty`);
  return { name, description: description.trim().replace(/\s+/g, " "), body: body.trim() };
}

export function parseConfig(text: string, agentNames: string[]): Config {
  let raw: unknown;
  try {
    raw = parse(text) ?? {};
  } catch (e) {
    throw new Error(`subagentsync/config.yaml: invalid YAML: ${(e as Error).message}`);
  }
  const agents = (raw as { agents?: unknown }).agents ?? {};
  if (typeof agents !== "object" || Array.isArray(agents)) throw new Error(`subagentsync/config.yaml: "agents" must be a mapping`);
  const errors: string[] = [];
  const config: Config = {};
  for (const [name, perPlatform] of Object.entries(agents as Record<string, unknown>)) {
    if (!agentNames.includes(name)) {
      errors.push(`subagentsync/config.yaml: "${name}" has no definition in subagentsync/agents/${name}.md`);
      continue;
    }
    if (perPlatform === null || typeof perPlatform !== "object" || Array.isArray(perPlatform)) {
      errors.push(`subagentsync/config.yaml: agents.${name} must be a mapping of platforms`);
      continue;
    }
    config[name] = {};
    for (const [platform, settings] of Object.entries(perPlatform as Record<string, unknown>)) {
      if (!(PLATFORMS as readonly string[]).includes(platform)) {
        errors.push(`agents.${name}: unknown platform "${platform}" (expected ${PLATFORMS.join(", ")})`);
        continue;
      }
      if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
        errors.push(`agents.${name}.${platform}: must be a mapping`);
        continue;
      }
      const caps = CAPABILITIES[platform as Platform];
      for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
        const type = key === "enabled" ? "boolean" : caps[key];
        const path = `agents.${name}.${platform}.${key}`;
        if (!type) {
          errors.push(`${path}: not supported by ${platform} (supported: ${Object.keys(caps).join(", ")})`);
        } else if (type === "string[]" ? !Array.isArray(value) || value.some((v) => typeof v !== "string") : typeof value !== type) {
          errors.push(`${path}: expected ${type}`);
        }
      }
      config[name][platform as Platform] = settings as PlatformSettings;
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return config;
}

function tomlString(s: string): string {
  return JSON.stringify(s);
}

function tomlMultiline(s: string): string {
  return `"""\n${s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}\n"""`;
}

function frontmatter(data: Record<string, unknown>): string {
  return `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n`;
}

function banner(name: string): string {
  return `${MARKER} from subagentsync/agents/${name}.md + subagentsync/config.yaml. Do not edit; run \`npx subagentsync sync\`.`;
}

/** Relative output path (forward slashes) for an agent on a platform. */
export function outputPath(platform: Platform, name: string): string {
  return `.${platform}/agents/${name}.${platform === "codex" ? "toml" : "md"}`;
}

export function generate(agent: Agent, platform: Platform, settings: PlatformSettings = {}): string {
  const { enabled: _enabled, ...rest } = settings;
  const fields: Record<string, unknown> = {};
  for (const key of Object.keys(CAPABILITIES[platform])) {
    if (key in rest) fields[key] = key === "tools" || key === "disallowedTools" ? (rest[key] as string[]).join(", ") : rest[key];
  }
  if (platform === "codex") {
    const lines = [`# ${banner(agent.name)}`, `name = ${tomlString(agent.name)}`, `description = ${tomlString(agent.description)}`];
    for (const [k, v] of Object.entries(fields)) lines.push(`${k} = ${tomlString(String(v))}`);
    lines.push(`developer_instructions = ${tomlMultiline(agent.body)}`);
    return lines.join("\n") + "\n";
  }
  if (platform === "claude" && !("model" in fields)) fields.model = "inherit";
  const head = { name: agent.name, description: agent.description, ...fields };
  return `${frontmatter(head)}\n<!-- ${banner(agent.name)} -->\n\n${agent.body}\n`;
}

export function isGenerated(text: string): boolean {
  return text.includes(`${MARKER} from subagentsync/agents/`) || text.includes(`${MARKER} from agents/`);
}

export function serializeAgent(agent: Agent): string {
  return `${frontmatter({ name: agent.name, description: agent.description })}\n${agent.body}\n`;
}
