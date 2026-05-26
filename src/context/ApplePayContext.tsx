import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applePayEvents,
  canMakePaymentsWithNetworks,
  completePayment,
  dismissPayment,
  requestPayment,
  updateShippingMethods,
  updateShippingMethodsWithError,
} from "../native/ApplePayModule";
import type {
  ApplePayConfig,
  PaymentItem,
  PaymentResult,
  ShippingContact,
  ShippingMethod,
} from "../types";

const DEFAULT_NETWORKS = ["visa", "masterCard", "amex"] as const;
const PROCESSING_WATCHDOG_MS = 60_000;

interface ApplePayContextValue {
  /** Whether the device supports Apple Pay. */
  isAvailable: boolean;
  /** Whether availability is still being checked. */
  isLoading: boolean;
  /** Whether a payment sheet is currently presented. */
  isProcessing: boolean;
  /** Start a payment. Resolves with the token or throws on cancel/error. */
  pay: (
    items: PaymentItem[],
    shippingMethods?: ShippingMethod[],
  ) => Promise<PaymentResult>;
  /** Tell PassKit your server's processing result. Required after `pay()` resolves. */
  complete: (success: boolean) => Promise<void>;
  /** Programmatically dismiss the sheet. */
  dismiss: () => Promise<void>;
}

const ApplePayContext = createContext<ApplePayContextValue | null>(null);

interface ApplePayProviderProps {
  children: ReactNode;
  config: ApplePayConfig;
  /**
   * Optional callback when the user changes shipping contact. Return updated
   * items + shipping methods, or throw to show an error in the sheet.
   */
  onShippingContactChange?: (contact: ShippingContact) => Promise<{
    items: PaymentItem[];
    shippingMethods?: ShippingMethod[];
  }>;
  /**
   * Optional callback when the user picks a different shipping method.
   * Return updated items so the total reflects the new shipping cost.
   */
  onShippingMethodChange?: (method: ShippingMethod) => Promise<{
    items: PaymentItem[];
  }>;
}

export function ApplePayProvider({
  children,
  config,
  onShippingContactChange,
  onShippingMethodChange,
}: ApplePayProviderProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const networksKey = (config.supportedNetworks ?? DEFAULT_NETWORKS).join(",");
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check availability on mount and whenever the requested networks change.
  useEffect(() => {
    let mounted = true;
    const networks = (config.supportedNetworks ??
      Array.from(DEFAULT_NETWORKS)) as ApplePayConfig["supportedNetworks"];
    (async () => {
      try {
        const available = await canMakePaymentsWithNetworks(networks!);
        if (mounted) setIsAvailable(available);
      } catch {
        if (mounted) setIsAvailable(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networksKey]);

  // Subscribe to shipping callbacks.
  useEffect(() => {
    if (!applePayEvents) return undefined;
    const subs = [
      onShippingContactChange &&
        applePayEvents.addListener(
          "onShippingContactChange",
          async (contact: ShippingContact) => {
            try {
              const result = await onShippingContactChange(contact);
              await updateShippingMethods(
                result.items,
                result.shippingMethods ?? [],
              );
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Invalid address";
              await updateShippingMethodsWithError(message).catch(() => {});
            }
          },
        ),
      onShippingMethodChange &&
        applePayEvents.addListener(
          "onShippingMethodChange",
          async (method: ShippingMethod) => {
            try {
              const result = await onShippingMethodChange(method);
              await updateShippingMethods(result.items, []);
            } catch {
              await updateShippingMethodsWithError(
                "Failed to update shipping method",
              ).catch(() => {});
            }
          },
        ),
    ].filter(Boolean);

    return () => {
      subs.forEach((sub) => sub && sub.remove());
    };
  }, [onShippingContactChange, onShippingMethodChange]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  // Cleanup watchdog on unmount.
  useEffect(() => clearWatchdog, [clearWatchdog]);

  const pay = useCallback(
    async (
      items: PaymentItem[],
      shippingMethods?: ShippingMethod[],
    ): Promise<PaymentResult> => {
      setIsProcessing(true);
      try {
        const result = await requestPayment(config, { items, shippingMethods });
        clearWatchdog();
        watchdogRef.current = setTimeout(() => {
          console.warn(
            "[react-native-easy-apple-pay] complete() was not called within 60s after pay() resolved. Resetting processing state.",
          );
          setIsProcessing(false);
        }, PROCESSING_WATCHDOG_MS);
        return result;
      } catch (err) {
        setIsProcessing(false);
        throw err;
      }
      // config is intentionally captured at call time; consumers must memoize.
    },
    [config, clearWatchdog],
  );

  const complete = useCallback(
    async (success: boolean) => {
      clearWatchdog();
      try {
        await completePayment(success);
      } finally {
        setIsProcessing(false);
      }
    },
    [clearWatchdog],
  );

  const dismiss = useCallback(async () => {
    clearWatchdog();
    try {
      await dismissPayment();
    } finally {
      setIsProcessing(false);
    }
  }, [clearWatchdog]);

  const value = useMemo<ApplePayContextValue>(
    () => ({ isAvailable, isLoading, isProcessing, pay, complete, dismiss }),
    [isAvailable, isLoading, isProcessing, pay, complete, dismiss],
  );

  return (
    <ApplePayContext.Provider value={value}>
      {children}
    </ApplePayContext.Provider>
  );
}

/**
 * Hook to access Apple Pay functionality. Must be used inside `<ApplePayProvider>`.
 */
export function useApplePay(): ApplePayContextValue {
  const ctx = useContext(ApplePayContext);
  if (!ctx) {
    throw new Error("useApplePay() must be used within an <ApplePayProvider>");
  }
  return ctx;
}
