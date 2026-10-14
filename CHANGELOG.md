# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-10-13

### Added

- Canonical agent definitions in `subagentsync/agents/<name>.md` (name, description, instructions).
- Per-platform settings in `subagentsync/config.yaml` for Claude Code, Cursor and OpenAI Codex.
- Generators for `.claude/agents/*.md`, `.cursor/agents/*.md` and `.codex/agents/*.toml`.
- `subagentsync` CLI (`npx subagentsync init | sync | check | migrate`), published as a compiled package. `init` scaffolds `subagentsync/` with an example agent and config and generates the platform files.
- Validation that rejects settings a platform doesn't support.
- Overwrite protection: only files with the `AUTO-GENERATED` marker are changed or deleted.
