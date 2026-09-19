# Mobile App (Android)

The Android app lives in [`apps/mobile/`](../apps/mobile/) and shares business logic (services, types, i18n) with the web frontend via [`packages/shared/`](../packages/shared/). Stack: Expo SDK 57, React Native, expo-router, NativeWind.

## Building the APK

**EAS cloud build** (recommended — no local Android toolchain needed):

```bash
cd apps/mobile
npx eas-cli login                  # Expo account (create one at expo.dev)
npx eas-cli build --platform android --profile preview
```

The `preview` profile produces an APK for internal distribution. When the build finishes (~15–25 min) you get a QR code + URL to install directly on a device.

> If you prefer a global install over `npx`, run `npm config set prefix ~/.npm-global && export PATH="$HOME/.npm-global/bin:$PATH"` once, then `npm install -g eas-cli`.

**Local build** (requires Android SDK + JDK 17):

```bash
cd apps/mobile
npx eas build --platform android --profile preview --local
```

**Development** (debug build on a connected device/emulator):

```bash
cd apps/mobile
npx expo run:android
```
