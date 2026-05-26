import { Platform } from "react-native";
import {
  canMakePayments,
  canMakePaymentsWithNetworks,
  requestPayment,
  updateShippingMethods,
} from "../src/native/ApplePayModule";
import { ApplePayError } from "../src/types";

const stub = globalThis.__RNEasyApplePayStub;

beforeEach(() => {
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  stub.canMakePayments = jest.fn().mockResolvedValue(true);
  stub.canMakePaymentsWithNetworks = jest.fn().mockResolvedValue(true);
  stub.requestPayment = jest.fn().mockResolvedValue({
    token: "abc",
    transactionIdentifier: "tx-1",
    paymentMethod: { network: "visa", type: "debit", displayName: "Visa" },
  });
  stub.completePayment = jest.fn().mockResolvedValue(undefined);
  stub.dismissPayment = jest.fn().mockResolvedValue(undefined);
  stub.updateShippingMethods = jest.fn().mockResolvedValue(undefined);
  stub.updateShippingMethodsWithError = jest.fn().mockResolvedValue(undefined);
});

describe("ApplePayModule on iOS", () => {
  it("canMakePayments delegates to native", async () => {
    await expect(canMakePayments()).resolves.toBe(true);
    expect(stub.canMakePayments).toHaveBeenCalled();
  });

  it("canMakePaymentsWithNetworks forwards the network list", async () => {
    await canMakePaymentsWithNetworks(["visa", "amex"]);
    expect(stub.canMakePaymentsWithNetworks).toHaveBeenCalledWith([
      "visa",
      "amex",
    ]);
  });

  it("requestPayment fills in default networks and capabilities", async () => {
    await requestPayment(
      {
        merchantIdentifier: "merchant.foo",
        countryCode: "US",
        currencyCode: "USD",
      },
      { items: [{ label: "Total", amount: "9.99" }] },
    );

    expect(stub.requestPayment).toHaveBeenCalledTimes(1);
    const call = (stub.requestPayment as jest.Mock).mock.calls[0][0];
    expect(call.supportedNetworks).toEqual(["visa", "masterCard", "amex"]);
    expect(call.merchantCapabilities).toEqual(["3DS"]);
    expect(call.shippingMethods).toEqual([]);
  });

  it("requestPayment rejects empty items", async () => {
    await expect(
      requestPayment(
        { merchantIdentifier: "m", countryCode: "US", currencyCode: "USD" },
        { items: [] },
      ),
    ).rejects.toMatchObject({
      name: "ApplePayError",
      code: "INVALID_PARAMS",
    });
  });

  it("requestPayment rejects malformed amounts", async () => {
    await expect(
      requestPayment(
        { merchantIdentifier: "m", countryCode: "US", currencyCode: "USD" },
        { items: [{ label: "Bad", amount: "1,99" }] },
      ),
    ).rejects.toBeInstanceOf(ApplePayError);

    await expect(
      requestPayment(
        { merchantIdentifier: "m", countryCode: "US", currencyCode: "USD" },
        { items: [{ label: "Neg", amount: "-1.00" }] },
      ),
    ).rejects.toBeInstanceOf(ApplePayError);
  });

  it("requestPayment wraps native errors as ApplePayError when code is present", async () => {
    const native = Object.assign(new Error("user cancelled"), {
      code: "USER_CANCELLED",
    });
    (stub.requestPayment as jest.Mock).mockRejectedValueOnce(native);

    await expect(
      requestPayment(
        { merchantIdentifier: "m", countryCode: "US", currencyCode: "USD" },
        { items: [{ label: "Total", amount: "1.00" }] },
      ),
    ).rejects.toMatchObject({
      name: "ApplePayError",
      code: "USER_CANCELLED",
    });
  });

  it("updateShippingMethods validates items before calling native", async () => {
    await expect(updateShippingMethods([], [])).rejects.toBeInstanceOf(
      ApplePayError,
    );
    expect(stub.updateShippingMethods).not.toHaveBeenCalled();
  });
});

describe("ApplePayModule on android", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
  });

  it("soft-guards canMakePayments and returns false", async () => {
    await expect(canMakePayments()).resolves.toBe(false);
  });

  it("requestPayment throws PLATFORM_UNSUPPORTED", async () => {
    await expect(
      requestPayment(
        { merchantIdentifier: "m", countryCode: "US", currencyCode: "USD" },
        { items: [{ label: "Total", amount: "1.00" }] },
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_UNSUPPORTED" });
  });
});
