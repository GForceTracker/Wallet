---
name: Workspace dependency install
description: Dependency installation behavior for the imported multi-artifact workspace
---

When validating one artifact in this imported monorepo, install that artifact's workspace dependency graph instead of installing every workspace package at once.

**Why:** The full workspace includes code-generation dependencies that may be blocked by the package firewall even when the frontend or Python API can install and run normally.

**How to apply:** Prefer the narrowest workspace filter that includes the target artifact and its local dependencies; do not change pinned versions or bypass the package firewall just to start an unrelated artifact.