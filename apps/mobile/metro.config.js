const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// getDefaultConfig auto-detects the npm workspace root and adds
// packages/shared to watchFolders (see root package.json workspaces).
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
