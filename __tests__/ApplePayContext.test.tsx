import { Text, Button } from "react-native";
import { render, act, fireEvent, waitFor } from "@testing-library/react-native";

import { ApplePayProvider, useApplePay } from "../src/context/ApplePayContext";
import { applePayEvents } from "../src/native/ApplePayModule";
import type { ApplePayConfig, ShippingContact } from "../src/types";

const stub = globalThis.__RNEasyApplePayStub;

const config: ApplePayConfig = {
  merchantIdentifier: "merchant.test",
  countryCode: "US",
  currencyCode: "USD",
};

function Inspector() {
  const value = useApplePay();
  return (
    <>
      <Text testID="isLoading">{String(value.isLoading)}</Text>
      <Text testID="isAvailable">{String(value.isAvailable)}</Text>
      <Text testID="isProcessing">{String(value.isProcessing)}</Text>
      <Button
        testID="pay"
        title="pay"
        onPress={() =>
          value.pay([{ label: "Total", amount: "5.00" }]).catch(() => {})
        }
      />
      <Button
        testID="complete"
        title="complete"
        onPress={() => value.complete(true).catch(() => {})}
      />
    </>
  );
}

describe("ApplePayProvider", () => {
  beforeEach(() => {
    stub.canMakePaymentsWithNetworks = jest.fn().mockResolvedValue(true);
    stub.requestPayment = jest.fn().mockResolvedValue({
      token: "tok",
      transactionIdentifier: "txn",
      paymentMethod: { network: "visa", type: "debit", displayName: "Visa" },
    });
    stub.completePayment = jest.fn().mockResolvedValue(undefined);
    stub.dismissPayment = jest.fn().mockResolvedValue(undefined);
    stub.updateShippingMethods = jest.fn().mockResolvedValue(undefined);
  });

  it("transitions from isLoading to isAvailable", async () => {
    const { getByTestId } = render(
      <ApplePayProvider config={config}>
        <Inspector />
      </ApplePayProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("isLoading").props.children).toBe("false");
    });
    expect(getByTestId("isAvailable").props.children).toBe("true");
  });

  it("reports unavailable when canMakePaymentsWithNetworks rejects", async () => {
    (stub.canMakePaymentsWithNetworks as jest.Mock).mockRejectedValueOnce(
      new Error("boom"),
    );
    const { getByTestId } = render(
      <ApplePayProvider config={config}>
        <Inspector />
      </ApplePayProvider>,
    );
    await waitFor(() => {
      expect(getByTestId("isLoading").props.children).toBe("false");
    });
    expect(getByTestId("isAvailable").props.children).toBe("false");
  });

  it("completes the payment cycle and resets isProcessing", async () => {
    const { getByTestId } = render(
      <ApplePayProvider config={config}>
        <Inspector />
      </ApplePayProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("isLoading").props.children).toBe("false");
    });

    await act(async () => {
      fireEvent.press(getByTestId("pay"));
    });
    expect(stub.requestPayment).toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByTestId("complete"));
    });
    expect(stub.completePayment).toHaveBeenCalledWith(true);
    expect(getByTestId("isProcessing").props.children).toBe("false");
  });

  it("invokes onShippingContactChange when the native event fires and forwards the items back", async () => {
    const onShippingContactChange = jest.fn(async (_c: ShippingContact) => ({
      items: [{ label: "Total", amount: "8.00" }],
      shippingMethods: [],
    }));

    render(
      <ApplePayProvider
        config={config}
        onShippingContactChange={onShippingContactChange}
      >
        <Inspector />
      </ApplePayProvider>,
    );

    // applePayEvents is a real NativeEventEmitter. Drive it by emitting through
    // the same channel the bridge would use.
    await act(async () => {
      (applePayEvents as { emit: (n: string, p: unknown) => void }).emit(
        "onShippingContactChange",
        { emailAddress: "test@example.com" },
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onShippingContactChange).toHaveBeenCalledWith({
        emailAddress: "test@example.com",
      });
    });
    await waitFor(() => {
      expect(stub.updateShippingMethods).toHaveBeenCalledWith(
        [{ label: "Total", amount: "8.00" }],
        [],
      );
    });
  });

  it("throws if useApplePay() is called outside the provider", () => {
    function Naked() {
      useApplePay();
      return null;
    }
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Naked />)).toThrow(/within an <ApplePayProvider>/);
    spy.mockRestore();
  });
});
