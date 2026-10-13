---
name: Expo patch validation and package freshness
description: Handle Expo validation warnings without bypassing dependency security policies
---

Expo's version validation can recommend patch releases that are still inside the workspace's minimum-release-age window. Do not bypass the freshness policy merely to silence these warnings.

**Why:** During imported-app preview recovery, Expo's suggested patch was less than a day old and installation was correctly refused, while the existing SDK-compatible patches successfully bundled and rendered.

**How to apply:** Run Expo's checks, attempt supported version alignment, and respect installation refusals. If only unavailable patch updates remain, verify the actual preview and disclose unresolved validation warnings rather than claiming all checks passed.
