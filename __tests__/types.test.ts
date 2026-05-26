import {
  ApplePayError,
  type ApplePayConfig,
  type ApplePayErrorCode,
  type PaymentItem,
  type PaymentNetwork,
  type PaymentResult,
} from "../src/types";

describe("ApplePayError", () => {
  it("carries a typed code", () => {
    const err = new ApplePayError("USER_CANCELLED", "x");
    expect(err.code).toBe("USER_CANCELLED");
    expect(err.name).toBe("ApplePayError");
    expect(err.message).toBe("x");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts an attached native error", () => {
    const native = new Error("native");
    const err = new ApplePayError("INVALID_PARAMS", "x", native);
    expect(err.nativeError).toBe(native);
  });
});

// Compile-time guards. If these stop compiling, the public surface drifted.
function _typeGuards() {
  const network: PaymentNetwork = "visa";
  const code: ApplePayErrorCode = "USER_CANCELLED";
  const item: PaymentItem = { label: "x", amount: "1.00" };
  const config: ApplePayConfig = {
    merchantIdentifier: "x",
    countryCode: "US",
    currencyCode: "USD",
  };
  const result: PaymentResult = {
    token: "x",
    transactionIdentifier: "x",
    paymentMethod: {
      network: "visa",
      type: "debit",
      displayName: "x",
    },
  };
  return { network, code, item, config, result };
}

it("type guards compile", () => {
  expect(_typeGuards).toBeDefined();
});
