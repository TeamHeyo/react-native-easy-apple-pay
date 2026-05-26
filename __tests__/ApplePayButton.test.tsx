import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

import { ApplePayButton } from "../src/components/ApplePayButton";
import { ApplePayProvider } from "../src/context/ApplePayContext";
import type { ApplePayConfig } from "../src/types";

const stub = globalThis.__RNEasyApplePayStub;

const config: ApplePayConfig = {
  merchantIdentifier: "merchant.test",
  countryCode: "US",
  currencyCode: "USD",
};

const items = [{ label: "Total", amount: "9.99" }];

describe("ApplePayButton", () => {
  beforeEach(() => {
    stub.canMakePaymentsWithNetworks = jest.fn().mockResolvedValue(true);
    stub.requestPayment = jest.fn().mockResolvedValue({
      token: "tok",
      transactionIdentifier: "txn",
      paymentMethod: { network: "visa", type: "debit", displayName: "Visa" },
    });
    stub.completePayment = jest.fn().mockResolvedValue(undefined);
  });

  it("renders nothing while loading", () => {
    stub.canMakePaymentsWithNetworks = jest
      .fn()
      .mockImplementation(() => new Promise(() => {}));
    const { queryByTestId } = render(
      <ApplePayProvider config={config}>
        <ApplePayButton items={items} onPayment={async () => true} />
      </ApplePayProvider>,
    );
    expect(queryByTestId("apple-pay-button")).toBeNull();
  });

  it("renders nothing when Apple Pay is unavailable", async () => {
    stub.canMakePaymentsWithNetworks = jest.fn().mockResolvedValue(false);
    const { queryByTestId } = render(
      <ApplePayProvider config={config}>
        <ApplePayButton items={items} onPayment={async () => true} />
      </ApplePayProvider>,
    );
    await waitFor(() =>
      expect(stub.canMakePaymentsWithNetworks).toHaveBeenCalled(),
    );
    expect(queryByTestId("apple-pay-button")).toBeNull();
  });

  it("runs the pay → onPayment → complete cycle", async () => {
    const onPayment = jest.fn(async () => true);
    const { getByTestId } = render(
      <ApplePayProvider config={config}>
        <ApplePayButton items={items} onPayment={onPayment} />
      </ApplePayProvider>,
    );
    const button = await waitFor(() => getByTestId("apple-pay-button"));

    await act(async () => {
      fireEvent.press(button);
    });

    expect(stub.requestPayment).toHaveBeenCalled();
    expect(onPayment).toHaveBeenCalled();
    expect(stub.completePayment).toHaveBeenCalledWith(true);
  });

  it("swallows USER_CANCELLED but surfaces other errors via onError", async () => {
    const onError = jest.fn();
    (stub.requestPayment as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("cancelled"), { code: "USER_CANCELLED" }),
    );

    const { getByTestId, rerender } = render(
      <ApplePayProvider config={config}>
        <ApplePayButton
          items={items}
          onPayment={async () => true}
          onError={onError}
        />
      </ApplePayProvider>,
    );
    const button = await waitFor(() => getByTestId("apple-pay-button"));
    await act(async () => {
      fireEvent.press(button);
    });
    expect(onError).not.toHaveBeenCalled();

    (stub.requestPayment as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "UNABLE_TO_PRESENT" }),
    );
    rerender(
      <ApplePayProvider config={config}>
        <ApplePayButton
          items={items}
          onPayment={async () => true}
          onError={onError}
        />
      </ApplePayProvider>,
    );
    const button2 = await waitFor(() => getByTestId("apple-pay-button"));
    await act(async () => {
      fireEvent.press(button2);
    });
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
