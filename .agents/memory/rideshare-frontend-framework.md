---
name: Rideshare frontend framework
description: Why frontend prototype requests should extend the current Rideshare Chats app
---

When a prompt names Next.js while asking to add screens or behavior to Rideshare Chats, implement it in the existing React/Vite artifact unless the user explicitly requests a framework migration.

**Why:** The product already has a routed, previewable React application with approved screen designs. Replacing the framework just to add an isolated state-machine prototype would duplicate the app and risk breaking established screens.

**How to apply:** Keep the existing app and routing for additions; explain the adaptation plainly. If the user explicitly wants a Next.js conversion, scope that as a separate migration rather than assuming compatibility.