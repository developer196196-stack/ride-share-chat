const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm monorepo setup:
// - Keep Expo's default package watch folders so shared lib edits trigger rebuilds.
// - Resolve through the app's and the workspace root's node_modules.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), projectRoot]),
);
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Metro's default `unstable_conditionsByPlatform` only maps `web -> ['browser']`,
// so packages whose `exports` key on "react-native" fall through to their
// browser build on native. Add the condition back for ios/android.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  ios: ['react-native'],
  android: ['react-native'],
};

// Single-instance packages (prevents "Invalid hook call" from duplicate React
// copies): the web artifacts use a different React version from the catalog, so
// always resolve these — and their subpaths — as if imported from the app itself.
const SINGLETONS = ['react', 'react-dom', 'react-native', '@tanstack/react-query'];
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = SINGLETONS.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
  if (isSingleton) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'package.json') },
      moduleName,
      platform,
    );
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// Keep Metro's watcher away from directories other tooling creates/deletes while
// Metro is running (pnpm temp dirs, git internals, production export output).
const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const IGNORED_ROOTS = [
  path.join(workspaceRoot, '.local'),
  path.join(workspaceRoot, '.git'),
  path.join(workspaceRoot, 'sleek-temp-ref'),
  path.join(projectRoot, 'static-build'),
];
const ignoredRootsPattern = new RegExp(
  `^(?:${IGNORED_ROOTS.map(escapeForRegExp).join('|')})(?:[\\\\/].*)?$`,
);
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ignoredRootsPattern,
];

module.exports = config;
