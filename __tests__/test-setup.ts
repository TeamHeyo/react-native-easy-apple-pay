/**
 * Setup file loaded via jest `setupFiles`. Runs before any test file imports.
 * Installs a stub for the RNEasyApplePay native module so that `const { RNEasyApplePay } = NativeModules`
 * inside the library captures a working reference, and exposes a global to let tests rewire methods.
 */
import { NativeModules, Platform } from "react-native";

Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });

const stub: Record<string, (...args: unknown[]) => unknown> = {
  canMakePayments: () => Promise.resolve(true),
  canMakePaymentsWithNetworks: () => Promise.resolve(true),
  requestPayment: () => Promise.resolve({}),
  completePayment: () => Promise.resolve(undefined),
  dismissPayment: () => Promise.resolve(undefined),
  updateShippingMethods: () => Promise.resolve(undefined),
  updateShippingMethodsWithError: () => Promise.resolve(undefined),
  addListener: () => undefined,
  removeListeners: () => undefined,
};

(NativeModules as Record<string, unknown>).RNEasyApplePay = stub;
(globalThis as Record<string, unknown>).__RNEasyApplePayStub = stub;

declare global {
  // global mutable test stub — name must be on a `var` declaration
  // for it to be visible on `globalThis` in test files. eslint-disable-next-line no-var
  var __RNEasyApplePayStub: Record<string, (...args: unknown[]) => unknown>;
}

export {};
