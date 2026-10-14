# Contributing

Thanks for helping. This is a small tool, and the aim is to keep it small, so most contributions are a few lines plus a test.

## Setup

Requirements: **Node.js 22.18 or newer** for development (Node runs the TypeScript sources and tests directly). Users only need Node 18+, because the published package is compiled to `dist/`.

```bash
git clone https://github.com/UmutSahin0/subagentsync.git
cd subagentsync
npm install     # also builds dist/
npm test
npm run build
node dist/cli.js check
```

If these pass, you're ready.

## How the code is organised

| File | Responsibility |
|---|---|
| `src/lib.ts` | Pure functions: parse agent files, validate config, generate each platform's output. `CAPABILITIES` lists every supported setting. |
| `src/sync.ts` | File-system work: sync, check and migrate. |
| `src/init.ts` | Scaffolding for `init` (example agent, config, README). |
| `src/cli.ts` | Command-line entry point. |
| `src/sync.test.ts` | Tests (`node:test`). They run against temporary directories, never the real repo. |
| `docs/configuration.md` | User-facing reference for every setting. |

## Common contributions

### Support a new platform setting

For example, a new Claude Code frontmatter field:

1. Add it to `CAPABILITIES` in `src/lib.ts` with its type (`"string"`, `"boolean"`, `"number"` or `"string[]"`).
2. Add a test in `src/sync.test.ts` showing that it is emitted for that platform and rejected for the others.
3. Add a row to the platform's table in `docs/configuration.md` and to the README's "Supported settings" table.
4. Link the platform's official docs in your pull request. **Only add fields the platform documents.** Undocumented or guessed syntax is the main thing this tool protects users from.

### Support a new platform

Open an issue first so we can agree on the output format. You'll need a new entry in `PLATFORMS`, `CAPABILITIES`, `outputPath()` and `generate()`.

### Fix a bug

Add a test that fails without your fix.

## Guidelines

- **Keep dependencies at one** (`yaml`). If you think you need a new one, raise it in an issue first.
- **Generated output must stay deterministic.** Running `sync` twice must produce no changes. The tests check this.
- **Never touch files without the `AUTO-GENERATED` marker.**
- Match the existing style: small functions, no classes, comments only where the reason isn't obvious.
- Use erasable TypeScript only (types, interfaces, `as const`). Node strips types and doesn't compile them, so `enum`, `namespace` and parameter properties won't run.

## Pull requests

1. Fork the project and create a branch from the default branch.
2. Make the change with tests.
3. Run `npm test && npm run build && node dist/cli.js check`.
4. Open a pull request using the template. CI runs the same checks.

Small, focused pull requests are reviewed fastest.

## Reporting bugs and requesting features

Use the issue templates (**Bug** or **Feature**). For bugs, include your Node version, the agent file and config that trigger the problem, and the full error message.

## Code of conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
