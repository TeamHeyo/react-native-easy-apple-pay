/**
 * react-native-easy-apple-pay
 *
 * Drop-in Apple Pay for React Native. Wrap your app in `ApplePayProvider`,
 * then use `<ApplePayButton />` or the `useApplePay()` hook.
 *
 * @see https://github.com/yourname/react-native-easy-apple-pay
 */
export { ApplePayButton } from "./components/ApplePayButton";
export { ApplePayProvider, useApplePay } from "./context/ApplePayContext";
export {
  canMakePayments,
  canMakePaymentsWithNetworks,
  dismissPayment,
} from "./native/ApplePayModule";
export { ApplePayError } from "./types";
export type {
  ApplePayConfig,
  ApplePayButtonStyle,
  ApplePayButtonType,
  ApplePayErrorCode,
  MerchantCapability,
  PaymentItem,
  PaymentNetwork,
  PaymentRequest,
  PaymentResult,
  ShippingContact,
  ShippingMethod,
} from "./types";
