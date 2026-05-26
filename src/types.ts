/**
 * Card networks supported by Apple Pay. Pass these in
 * `ApplePayConfig.supportedNetworks` to restrict accepted cards.
 */
export type PaymentNetwork =
  | "visa"
  | "masterCard"
  | "amex"
  | "discover"
  | "chinaUnionPay"
  | "jcb"
  | "maestro"
  | "elo"
  | "electron";

/**
 * Merchant capabilities. `3DS` is required by most processors.
 */
export type MerchantCapability = "3DS" | "EMV" | "credit" | "debit";

/** Visual style of the Apple Pay button. */
export type ApplePayButtonStyle = "black" | "white" | "whiteOutline";

/** Label variant of the Apple Pay button. */
export type ApplePayButtonType =
  | "plain"
  | "buy"
  | "setUp"
  | "inStore"
  | "donate"
  | "checkout"
  | "book"
  | "subscribe"
  | "reload"
  | "addMoney"
  | "topUp"
  | "order"
  | "rent"
  | "support"
  | "contribute"
  | "tip";

/**
 * Error codes that may appear on a thrown `ApplePayError` (or as `.code` on
 * raw native errors). Most consumers should match on these in their `onError`.
 */
export type ApplePayErrorCode =
  | "USER_CANCELLED"
  | "ALREADY_PRESENTING"
  | "INVALID_PARAMS"
  | "NO_VIEW_CONTROLLER"
  | "UNABLE_TO_PRESENT"
  | "NOT_AVAILABLE"
  | "NO_PENDING_PAYMENT"
  | "NO_PENDING_UPDATE"
  | "PLATFORM_UNSUPPORTED"
  | "NATIVE_MODULE_MISSING";

/** Strongly-typed error thrown by this library. */
export class ApplePayError extends Error {
  readonly code: ApplePayErrorCode;
  readonly nativeError?: unknown;
  constructor(
    code: ApplePayErrorCode,
    message: string,
    nativeError?: unknown,
  ) {
    super(message);
    this.name = "ApplePayError";
    this.code = code;
    this.nativeError = nativeError;
  }
}

/**
 * A line item shown in the Apple Pay sheet. Amount must be a non-negative
 * decimal string with up to two fraction digits (e.g. `"19.99"`).
 */
export interface PaymentItem {
  label: string;
  amount: string;
  /** "pending" hides the amount and shows a spinner. Defaults to "final". */
  type?: "final" | "pending";
}

export interface ShippingMethod {
  identifier: string;
  label: string;
  detail: string;
  amount: string;
}

export interface ShippingContact {
  name?: { givenName?: string; familyName?: string };
  emailAddress?: string;
  phoneNumber?: string;
  postalAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    isoCountryCode?: string;
  };
}

/**
 * Configuration passed to `ApplePayProvider`. Memoize this at the call site if
 * `supportedNetworks` would otherwise be a fresh array on each render.
 */
export interface ApplePayConfig {
  merchantIdentifier: string;
  countryCode: string;
  currencyCode: string;
  supportedNetworks?: PaymentNetwork[];
  merchantCapabilities?: MerchantCapability[];
  requiredShippingContactFields?: (
    | "postalAddress"
    | "name"
    | "phone"
    | "email"
  )[];
  requiredBillingContactFields?: (
    | "postalAddress"
    | "name"
    | "phone"
    | "email"
  )[];
}

export interface PaymentRequest {
  items: PaymentItem[];
  shippingMethods?: ShippingMethod[];
}

export interface PaymentResult {
  /** Base64-encoded PKPaymentToken.paymentData blob, ready to send to your processor. */
  token: string;
  transactionIdentifier: string;
  paymentMethod: {
    /**
     * Returns a `PaymentNetwork` for known cards, or a raw PassKit string
     * (e.g. `"PrivateLabel"`) for networks not represented in our enum.
     */
    network: PaymentNetwork | (string & {});
    type: "debit" | "credit" | "prepaid" | "store" | "eMoney" | "unknown";
    displayName: string;
  };
  billingContact?: ShippingContact;
  shippingContact?: ShippingContact;
  shippingMethod?: ShippingMethod;
  paymentData?: {
    data?: string;
    signature?: string;
    header?: {
      ephemeralPublicKey?: string;
      publicKeyHash?: string;
      transactionId?: string;
    };
    version?: string;
  };
}
