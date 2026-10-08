#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Clear the Metro bundler cache so the next mobile workflow start uses a fresh graph.
METRO_CACHE="artifacts/mobile/node_modules/.cache/metro"
if [ -d "$METRO_CACHE" ]; then
  echo "post-merge: clearing stale Metro cache at $METRO_CACHE"
  rm -rf "$METRO_CACHE"
fi
