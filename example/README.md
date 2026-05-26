# react-native-easy-apple-pay example

Minimal Expo dev-client app that consumes the library via a relative `file:..` dependency.

## Run

You need a Mac with Xcode and a real iPhone (simulator doesn't authorize Apple Pay; it only reports `canMakePayments`).

```bash
cd example
npm install
# Generate native projects (run once; rerun with --clean after dependency changes)
npx expo prebuild --platform ios --clean
# Build and run the dev-client onto a connected device
npm run ios:device
```

To test the new architecture path:

```bash
npm run ios:newarch
```

## Configure for your developer account

`app.json` declares a placeholder bundle identifier and merchant ID. Update both to your real values before signing builds:

- `expo.ios.bundleIdentifier`: your app's bundle ID
- `expo.ios.entitlements["com.apple.developer.in-app-payments"]`: your merchant ID, e.g. `merchant.com.yourcompany.yourapp`

Update the same merchant ID in `App.tsx` (`MERCHANT_ID`).

## Manual checklist for "production ready"

Run the app and verify:

- [ ] Button renders on real device with card in Wallet, doesn't render on Android / simulator without Wallet
- [ ] Tap → sheet appears → authorize with Touch/Face ID → server stub logs token → sheet dismisses
- [ ] Tap → sheet appears → swipe to dismiss → no `onError` fires (USER_CANCELLED is swallowed)
- [ ] Repeat with `RCT_NEW_ARCH_ENABLED=1` (new arch) and confirm same behavior
