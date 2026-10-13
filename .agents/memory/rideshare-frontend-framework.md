---
name: Rideshare frontend framework
description: Preserve the framework of the specific Rideshare artifact being changed
---

Preserve the framework of the artifact the user is changing rather than migrating it because an example prompt names another framework. The earlier React/Vite decision applies to the legacy web rider prototype, not to the newer Expo app imported from main.

**Why:** The product already has a routed, previewable React application with approved screen designs. Replacing the framework just to add an isolated state-machine prototype would duplicate the app and risk breaking established screens.

**How to apply:** Determine which app the user means before adding screens. Keep its existing routing and framework. Do not translate Expo requests into the legacy web app or replace the old web preview when showing the newer mobile artifact. Scope explicit framework conversions separately.