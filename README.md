# react-native-easy-apple-pay

The simplest way to add Apple Pay to your React Native app. No boilerplate. No confusion. Just wrap, drop, and pay.

[![CI](https://github.com/yourname/react-native-easy-apple-pay/actions/workflows/ci.yml/badge.svg)](https://github.com/yourname/react-native-easy-apple-pay/actions)

## Quick Start

```bash
npm install react-native-easy-apple-pay
cd ios && pod install
```

### 1. Wrap your app

```tsx
import { ApplePayProvider } from "react-native-easy-apple-pay";

export default function App() {
  return (
    <ApplePayProvider config={{
      merchantIdentifier: "merchant.com.yourapp",
      countryCode: "US",
      currencyCode: "USD",
    }}>
      <YourApp />
    </ApplePayProvider>
  );
}
```

### 2. Drop in a button

```tsx
import { ApplePayButton } from "react-native-easy-apple-pay";

<ApplePayButton
  items={[
    { label: "Blue T-Shirt", amount: "29.99" },
    { label: "Your Store",   amount: "29.99" },
  ]}
  onPayment={async (result) => {
    const res = await fetch("/api/charge", {
      method: "POST",
      body: JSON.stringify({ token: result.token }),
    });
    return res.ok;
  }}
  onError={(err) => console.warn(err.code, err.message)}
/>
```

The button auto-hides on non-Apple-Pay devices, shows a spinner during processing, swallows user-cancellations, and handles the full payment lifecycle.

### Or use the hook

```tsx
import { useApplePay } from "react-native-easy-apple-pay";

function Checkout() {
  const { isAvailable, pay, complete, dismiss } = useApplePay();

  const handlePay = async () => {
    try {
      const result = await pay([{ label: "Total", amount: "49.99" }]);
      const ok = await chargeServer(result.token);
      await complete(ok);
    } catch (err) {
      if (err.code !== "USER_CANCELLED") throw err;
    }
  };

  if (!isAvailable) return null;
  return <Button onPress={handlePay} title="Pay Now" />;
}
```

### Shipping callbacks

```tsx
<ApplePayProvider
  config={config}
  onShippingContactChange={async (contact) => {
    const rates = await fetchShipping(contact.postalAddress);
    return {
      items: [
        { label: "Subtotal", amount: "29.99" },
        { label: "Shipping", amount: rates.cheapest.amount },
        { label: "Total", amount: rates.cheapest.total },
      ],
      shippingMethods: rates.options,
    };
  }}
  onShippingMethodChange={async (method) => ({
    items: recomputeItems(method),
  })}
>
  ...
</ApplePayProvider>
```

## Error handling

All errors thrown by this library are instances of `ApplePayError` and carry a typed `.code`:

```ts
type ApplePayErrorCode =
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
```

`<ApplePayButton>` automatically swallows `USER_CANCELLED`; other codes bubble through to `onError`.

## Requirements

- React Native >= 0.72 (peer dep), new architecture supported
- iOS 15.1+ deployment target
- Apple Developer Account with a Merchant ID + Apple Pay capability enabled
- Payment processor (Stripe, Braintree, Adyen, etc.)

## Testing

The library ships a Jest mock at `__mocks__/react-native-easy-apple-pay.ts` so consumer apps can write tests without the native bridge. Import the helpers to drive mock state:

```ts
import { __setMockState } from "react-native-easy-apple-pay";

beforeEach(() =>
  __setMockState({ isAvailable: true, isProcessing: false }),
);
```

For end-to-end verification, see `example/` (Expo dev-client app).

## License

MIT
