---
name: Workspace test tooling installs
description: Installing root-level development tools in this pnpm workspace
---

The package installer may issue `pnpm add` at the workspace root without the required workspace-root flag; passing `-w` as a package token is rejected. For a genuinely shared repo-level dev tool, use an explicit `pnpm add -Dw <package>` if the installer cannot target the root.

**Why:** A regular installer attempt failed pnpm's workspace-root guard, and the install callback did not accept command flags as package entries. Installing a language module can also add incidental `.replit` settings; check and remove unrelated changes through the validated config flow.

**How to apply:** Only use the direct root-scoped command when the package-management callback cannot express the workspace install, then inspect the diff for unrelated configuration edits.