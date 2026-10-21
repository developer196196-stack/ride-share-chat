---
name: Admin preview isolation
description: Why the admin console must not replace the existing root rider preview.
---

Keep the admin console on a separate path instead of replacing the rider app at the domain root.

**Why:** The imported admin app claimed the same root path as the existing rider prototype, preventing it from registering as a separate preview. The user's request was to add admin-web alongside existing apps, not replace one.

**How to apply:** Preserve this separation when pulling upstream configuration changes. Align the admin framework's base path, browser API URLs, service routing, and health check rather than redirecting the rider preview.
