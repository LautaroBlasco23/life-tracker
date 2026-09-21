/**
 * Adds `android:usesCleartextTraffic="${usesCleartextTraffic}"` to the
 * application tag. The React Native gradle plugin resolves that placeholder
 * per build type (debug: true, release: false), so HTTP (emulator/LAN dev)
 * works in debug builds while release builds keep cleartext blocked.
 *
 * Needed because Expo SDK 57 no longer applies app.json's
 * `android.usesCleartextTraffic` key.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withCleartextManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    app.$['android:usesCleartextTraffic'] = '${usesCleartextTraffic}';
    return modConfig;
  });
};
