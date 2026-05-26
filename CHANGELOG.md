# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [1.1.0] — 2026-05-26

Production-readiness sweep. Most consumers can upgrade without code changes; the breaking changes are limited to type tightening and the iOS deployment-target bump.

### Added

- **New Architecture support** — TurboModule codegen spec (`src/NativeApplePay.ts`), podspec hook (`install_modules_dependencies`), and `RCT_NEW_ARCH_ENABLED` build flag wiring.
- **Working shipping-contact flow** — `onShippingContactChange` now actually updates the sheet. The native side stores the PassKit completion handler and `updateShippingMethods` / `updateShippingMethodsWithError` invoke it.
- **`onShippingMethodChange` callback** — re-price totals when the user picks a different shipping option.
- **`dismissPayment()`** is now exported from the public API and surfaced on the `useApplePay()` hook as `dismiss()`. Programmatically dismissing rejects the in-flight `pay()` with `USER_CANCELLED`.
- **`ApplePayError` class** with a typed `.code` (`ApplePayErrorCode` union). Native errors are wrapped automatically.
- **Item validation** — empty `items`, malformed `amount` strings, and missing labels reject with `INVALID_PARAMS` before crossing the bridge.
- **Watchdog timer** — if a consumer forgets to call `complete()` within 60s, `isProcessing` resets so the button isn't permanently disabled.
- **Jest suite** with 21 tests across module / context / button / types and an 80%+ line-coverage floor.
- **Expo dev-client example** under `example/` for end-to-end testing.
- **CI** (`.github/workflows/ci.yml`) runs typecheck / lint / test / build on Node 20 + 22.

### Changed

- **Build pipeline** migrated from raw `tsc` to `react-native-builder-bob`. Output now includes both CJS (`lib/commonjs`) and ESM (`lib/module`) plus a typed `exports` map. Package main/module/types/exports updated.
- **iOS deployment target** raised to **15.1** (matches React Native 0.85's floor; PassKit features are unchanged from 13).
- **Peer deps** floor raised to `react >=18`, `react-native >=0.72` (required for new arch + hooks behavior).
- **Reentrancy guard** on `requestPayment` — calling it while a sheet is already presented rejects with `ALREADY_PRESENTING` instead of orphaning the previous promise.
- **Scene-based key window** — replaced deprecated `UIApplication.shared.windows.first` with iOS 15+ `UIWindowScene` traversal.
- **Main-thread safety** — UIKit and PassKit callbacks (completion handler, dismiss) are now dispatched on the main queue.

### Removed

- `console.log("Payment result:", ...)` in `ApplePayContext` — previously leaked token data into device logs.

### Fixed

- Shipping-contact delegate never called PassKit's completion handler, freezing the sheet (`RNEasyApplePay.swift` shipping flow).
- `completePayment` was a silent no-op when called without a pending payment; now rejects with `NO_PENDING_PAYMENT`.
- `dismissPayment` did not reject the in-flight `pay()` promise; now does so with `USER_CANCELLED`.
- Cancellation path didn't clear `completionHandler`; a late `complete()` could fire on a torn-down sheet.
- Availability effect re-ran on every render when `supportedNetworks` was a fresh array; now keyed on a stable join.

## [1.0.0] — 2026-02-18

Initial release.
