const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Monorepo (npm workspaces: apps/mobile + packages/shared). Metro must watch
// the workspace root or the @shared/* tsconfig alias (../../packages/shared)
// fails to resolve ("Could not resolve <abs path to packages/shared/src>").
// Keep the root's node_modules in nodeModulesPaths so anything hoisted there
// resolves too.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
