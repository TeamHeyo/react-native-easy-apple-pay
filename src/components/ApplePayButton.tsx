import { memo, useCallback } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import type {
  PaymentItem,
  PaymentResult,
  ShippingMethod,
  ApplePayButtonStyle,
  ApplePayButtonType,
} from "../types";
import { useApplePay } from "../context/ApplePayContext";

interface ApplePayButtonProps {
  /** Items to charge. Last item is the displayed total. */
  items: PaymentItem[];
  /** Optional shipping methods. */
  shippingMethods?: ShippingMethod[];
  /** Called with the payment result after user authorizes. Return true on server-side success. */
  onPayment: (result: PaymentResult) => Promise<boolean>;
  /** Called when payment fails. Cancellations are swallowed. */
  onError?: (error: Error) => void;
  /** Visual style. */
  buttonStyle?: ApplePayButtonStyle;
  /** Label variant. */
  buttonType?: ApplePayButtonType;
  /** Custom container style. */
  style?: StyleProp<ViewStyle>;
  /** Disabled state. */
  disabled?: boolean;
  /** testID forwarded to the underlying TouchableOpacity. */
  testID?: string;
}

const BUTTON_LABELS: Record<ApplePayButtonType, string> = {
  plain: " Pay",
  buy: "Buy with  Pay",
  setUp: "Set Up  Pay",
  inStore: " Pay in Store",
  donate: "Donate with  Pay",
  checkout: "Check Out with  Pay",
  book: "Book with  Pay",
  subscribe: "Subscribe with  Pay",
  reload: "Reload with  Pay",
  addMoney: "Add Money with  Pay",
  topUp: "Top Up with  Pay",
  order: "Order with  Pay",
  rent: "Rent with  Pay",
  support: "Support with  Pay",
  contribute: "Contribute with  Pay",
  tip: "Tip with  Pay",
};

function ApplePayButtonImpl({
  items,
  shippingMethods,
  onPayment,
  onError,
  buttonStyle = "black",
  buttonType = "plain",
  style,
  disabled = false,
  testID,
}: ApplePayButtonProps) {
  const { isAvailable, isLoading, isProcessing, pay, complete } = useApplePay();

  const handlePress = useCallback(async () => {
    try {
      const result = await pay(items, shippingMethods);
      const success = await onPayment(result);
      await complete(success);
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error?.code !== "USER_CANCELLED") {
        onError?.(error);
      }
    }
  }, [items, shippingMethods, pay, complete, onPayment, onError]);

  if (isLoading || !isAvailable) return null;

  const bgColor =
    buttonStyle === "black"
      ? "#000"
      : buttonStyle === "white"
        ? "#fff"
        : "#fff";
  const textColor = buttonStyle === "black" ? "#fff" : "#000";
  const borderColor = buttonStyle === "whiteOutline" ? "#000" : "transparent";

  return (
    <TouchableOpacity
      testID={testID ?? "apple-pay-button"}
      onPress={handlePress}
      disabled={disabled || isProcessing}
      activeOpacity={0.7}
      style={[
        styles.button,
        dynamicStyle(bgColor, borderColor),
        (disabled || isProcessing) && styles.disabled,
        style,
      ]}
    >
      {isProcessing ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>
          {BUTTON_LABELS[buttonType] ?? " Pay"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export const ApplePayButton = memo(ApplePayButtonImpl);

function dynamicStyle(
  backgroundColor: string,
  borderColor: string,
): ViewStyle {
  return {
    backgroundColor,
    borderColor,
    borderWidth: borderColor === "transparent" ? 0 : 1,
  };
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    minWidth: 200,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.5,
  },
});
