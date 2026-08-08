---
title: >-
  Why librechat-mnemonic is a proxy: LibreChat memory cannot be scoped per
  project
tags:
  - librechat
  - mnemonic
  - architecture
  - decision
  - proxy
lifecycle: permanent
createdAt: '2026-08-08T08:39:10.892Z'
updatedAt: '2026-08-08T08:39:10.892Z'
role: decision
alwaysLoad: false
project: https-github-com-claudedowling-librechat-mnemonic
projectName: librechat-mnemonic
memoryVersion: 1
---
Decision (2026-08-08): librechat-mnemonic augments chats through an OpenAI/Anthropic-compatible **proxy** in the model request path, not by writing into LibreChat's own memory store and not by MCP tools alone. An MCP endpoint ships alongside it for explicit search and correction only.

## Why not LibreChat's built-in memory

Verified against LibreChat v0.8.7 source (commit `45cc53c`):

- `isMemoryAgentEnabled(config)` is `config?.agent?.enabled === true && hasValidAgent(config.agent)` (`packages/data-schemas/src/app/memory.ts`). When false, memory still works but is **read-only injection**: `useMemory()` calls `getRequestMemories` to `getFormattedMemories({ userId, agentId })` and `api/server/controllers/agents/client.js` builds `${memoryInstructions}\n\n# Existing memory about the user:\n${text}` into the shared run context. No tool call is involved.
- So an external writer *can* drive LibreChat's injection deterministically by populating the `MemoryEntry` collection.
- But `MemoryEntry` is `{ userId, key, value, agentId, tokenCount }` with no conversation or project dimension, and the load happens inside LibreChat before any external process runs. That channel therefore gives automatic-but-user-global memory, which is not what was wanted.

## Why not MCP tools alone

MCP tools are agent-discretionary: recall and save only happen when the model chooses to call them. That is "well-prompted", not "automatic".

## Why the proxy works

LibreChat resolves `{{LIBRECHAT_USER_ID}}` and `{{LIBRECHAT_BODY_CONVERSATIONID}}` into custom-endpoint and MCP headers. The project is *not* available that way: `ALLOWED_BODY_FIELDS` in `packages/api/src/utils/env.ts` is exactly `['conversationId', 'parentMessageId', 'messageId']`. The proxy therefore resolves the project itself, read-only, from LibreChat's own Mongo: `conversations.chatProjectId` then `chatprojects.name` (model `ChatProject`, explicit collection `chatprojects`, added in v0.8.7).

## Verified mnemonic behaviour (0.42, tested by running it)

- Project identity falls back to the plain directory basename when `cwd` is not in a git repo (`detectDefaultProject`, src/project.ts). `/projects/Home Network` resolves to `{ id: "home-network", name: "Home Network", source: "folder" }`. This is the mapping from a LibreChat project to a mnemonic project.
- `remember` with `scope: "global"` plus that `cwd` writes to the **main vault** while stamping the note `project: home-network` / `projectName: Home Network` in frontmatter. No `.mnemonic` project vault is created. This is the "one global vault, partitioned by project" shape.
- `list` / `recall` with `scope: "project"` return exactly that project's notes. `scope: "global"` returns **everything in the main vault including other projects' notes**, despite the tool description claiming it returns only unscoped memories. Use `scope: "project"` when isolation actually matters.
- `recall` with a non-existent `cwd` hard-errors with `Cannot use simple-git on a directory that does not exist`, because `findGitRoot` constructs `simpleGit(cwd)` outside its `attempt()` guard. Project directories must be created eagerly, on the filesystem of whichever process runs mnemonic.
- `MNEMONIC_PROJECT_ROOT` must sit outside any git repo, or every memory is attributed to that repo instead of the project.
- Explicit `scope` always wins in `resolveWriteScope`, so passing it avoids MRTR elicitation entirely. Main-vault writes are never blocked by protected-branch checks (`checkVaultProtectedBranch` returns early for `provenance === "main"`).

## Consequences

- Only traffic routed through the proxy is augmented. Endpoints pointed straight at a provider get nothing.
- Memory is user-global by project name; there is no per-user partition in the vault. Single-user and small-trusted-team only.
- Failures degrade to plain passthrough. Circuit breakers guard both Mongo and mnemonic after testing showed a mnemonic spawn failure crashed the process and a Mongo outage added roughly 15s per turn.
