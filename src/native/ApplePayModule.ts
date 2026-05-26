import { NativeModules, Platform, NativeEventEmitter } from "react-native";
import {
  ApplePayError,
  type PaymentNetwork,
  type ApplePayConfig,
  type PaymentRequest,
  type PaymentResult,
  type PaymentItem,
  type ShippingMethod,
} from "../types";

// Read Platform.OS and NativeModules lazily so tests can mutate them between cases.
interface NativeBridge {
  canMakePayments: () => Promise<boolean>;
  canMakePaymentsWithNetworks: (n: PaymentNetwork[]) => Promise<boolean>;
  requestPayment: (params: unknown) => Promise<PaymentResult>;
  completePayment: (success: boolean) => Promise<void>;
  dismissPayment: () => Promise<void>;
  updateShippingMethods: (
    items: PaymentItem[],
    methods: ShippingMethod[],
  ) => Promise<void>;
  updateShippingMethodsWithError: (msg: string) => Promise<void>;
}

function getNative(): NativeBridge | undefined {
  return NativeModules.RNEasyApplePay as NativeBridge | undefined;
}

const DEFAULT_NETWORKS: PaymentNetwork[] = ["visa", "masterCard", "amex"];
const DEFAULT_CAPABILITIES = ["3DS"] as const;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function assertIOSOrThrow(method: string): void {
  if (Platform.OS !== "ios") {
    throw new ApplePayError(
      "PLATFORM_UNSUPPORTED",
      `[react-native-easy-apple-pay] ${method} is only available on iOS.`,
    );
  }
  if (!getNative()) {
    throw new ApplePayError(
      "NATIVE_MODULE_MISSING",
      "[react-native-easy-apple-pay] Native module not linked. Did you run `pod install`?",
    );
  }
}

function softGuardIOS(method: string): boolean {
  if (Platform.OS !== "ios") {
    console.warn(
      `[react-native-easy-apple-pay] ${method} is only available on iOS.`,
    );
    return false;
  }
  if (!getNative()) {
    throw new ApplePayError(
      "NATIVE_MODULE_MISSING",
      "[react-native-easy-apple-pay] Native module not linked. Did you run `pod install`?",
    );
  }
  return true;
}

function validateItems(items: PaymentItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApplePayError(
      "INVALID_PARAMS",
      "`items` must be a non-empty array. The last item is the total shown to the user.",
    );
  }
  for (const item of items) {
    if (!item || typeof item.label !== "string" || item.label.length === 0) {
      throw new ApplePayError(
        "INVALID_PARAMS",
        "Every PaymentItem requires a non-empty `label`.",
      );
    }
    if (typeof item.amount !== "string" || !AMOUNT_PATTERN.test(item.amount)) {
      throw new ApplePayError(
        "INVALID_PARAMS",
        `PaymentItem amount must be a decimal string like "19.99" (got ${JSON.stringify(item.amount)}).`,
      );
    }
  }
}

function wrapNative<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err: { code?: string; message?: string } | Error) => {
    const code = (err as { code?: string }).code as
      | ApplePayError["code"]
      | undefined;
    const message =
      (err as Error).message ?? String(err) ?? "Apple Pay native error";
    if (code) {
      throw new ApplePayError(code, message, err);
    }
    throw err;
  });
}

/** Check if the device supports Apple Pay at all. Returns false on Android. */
export async function canMakePayments(): Promise<boolean> {
  if (!softGuardIOS("canMakePayments")) return false;
  return wrapNative(getNative()!.canMakePayments());
}

/** Check if the device can make payments with specific card networks. */
export async function canMakePaymentsWithNetworks(
  networks: PaymentNetwork[],
): Promise<boolean> {
  if (!softGuardIOS("canMakePaymentsWithNetworks")) return false;
  return wrapNative(getNative()!.canMakePaymentsWithNetworks(networks));
}

/** Present the Apple Pay payment sheet. Resolves with the authorization result. */
export async function requestPayment(
  config: ApplePayConfig,
  request: PaymentRequest,
): Promise<PaymentResult> {
  assertIOSOrThrow("requestPayment");
  validateItems(request.items);

  return wrapNative(
    getNative()!.requestPayment({
      ...config,
      supportedNetworks: config.supportedNetworks ?? DEFAULT_NETWORKS,
      merchantCapabilities:
        config.merchantCapabilities ?? Array.from(DEFAULT_CAPABILITIES),
      items: request.items,
      shippingMethods: request.shippingMethods ?? [],
    }),
  );
}

/** Tell PassKit your server's processing result. Required after `requestPayment` resolves. */
export async function completePayment(success: boolean): Promise<void> {
  assertIOSOrThrow("completePayment");
  return wrapNative(getNative()!.completePayment(success));
}

/** Programmatically dismiss the Apple Pay sheet. Rejects any in-flight `requestPayment` with USER_CANCELLED. */
export async function dismissPayment(): Promise<void> {
  if (!softGuardIOS("dismissPayment")) return;
  return wrapNative(getNative()!.dismissPayment());
}

/**
 * Update payment summary + available shipping methods in response to an
 * `onShippingContactChange` or `onShippingMethodChange` event.
 */
export async function updateShippingMethods(
  items: PaymentItem[],
  shippingMethods: ShippingMethod[] = [],
): Promise<void> {
  if (!softGuardIOS("updateShippingMethods")) return;
  validateItems(items);
  return wrapNative(
    getNative()!.updateShippingMethods(items, shippingMethods),
  );
}

/** Report a shipping-contact validation error back to the sheet. */
export async function updateShippingMethodsWithError(
  errorMessage: string,
): Promise<void> {
  if (!softGuardIOS("updateShippingMethodsWithError")) return;
  return wrapNative(
    getNative()!.updateShippingMethodsWithError(errorMessage),
  );
}

let _applePayEvents: NativeEventEmitter | null | undefined;

/** EventEmitter for native shipping callbacks. Lazy so tests can rewire the native module. */
export function getApplePayEvents(): NativeEventEmitter | null {
  if (_applePayEvents !== undefined) return _applePayEvents;
  const native = getNative();
  _applePayEvents =
    Platform.OS === "ios" && native
      ? new NativeEventEmitter(
          native as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
        )
      : null;
  return _applePayEvents;
}

/** Back-compat: same instance, eagerly evaluated. Prefer `getApplePayEvents()`. */
export const applePayEvents = getApplePayEvents();
