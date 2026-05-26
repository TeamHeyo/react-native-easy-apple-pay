import React from "react";
import { TouchableOpacity, Text } from "react-native";

const defaultMockResult = {
  token: "dGVzdF90b2tlbl9iYXNlNjQ=",
  transactionIdentifier: "TEST-TXN-12345",
  paymentMethod: {
    network: "visa" as const,
    type: "debit" as const,
    displayName: "Visa ••••4242",
  },
};

type MockState = {
  isAvailable: boolean;
  isLoading: boolean;
  isProcessing: boolean;
  payImpl: () => Promise<unknown>;
  completeImpl: () => Promise<void>;
  dismissImpl: () => Promise<void>;
};

const state: MockState = {
  isAvailable: true,
  isLoading: false,
  isProcessing: false,
  payImpl: () => Promise.resolve(defaultMockResult),
  completeImpl: () => Promise.resolve(),
  dismissImpl: () => Promise.resolve(),
};

/** Test-only helper to override the mock surface. */
export function __setMockState(partial: Partial<MockState>): void {
  Object.assign(state, partial);
}

/** Test-only helper to reset the mock to its default state. */
export function __resetMockState(): void {
  state.isAvailable = true;
  state.isLoading = false;
  state.isProcessing = false;
  state.payImpl = () => Promise.resolve(defaultMockResult);
  state.completeImpl = () => Promise.resolve();
  state.dismissImpl = () => Promise.resolve();
}

export const canMakePayments = jest.fn().mockResolvedValue(true);
export const canMakePaymentsWithNetworks = jest.fn().mockResolvedValue(true);
export const dismissPayment = jest.fn().mockResolvedValue(undefined);

export class ApplePayError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApplePayError";
    this.code = code;
  }
}

export const useApplePay = jest.fn(() => ({
  isAvailable: state.isAvailable,
  isLoading: state.isLoading,
  isProcessing: state.isProcessing,
  pay: jest.fn(() => state.payImpl()),
  complete: jest.fn(() => state.completeImpl()),
  dismiss: jest.fn(() => state.dismissImpl()),
}));

export const ApplePayProvider = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const ApplePayButton = jest.fn(({ onPayment, testID }: any) =>
  React.createElement(
    TouchableOpacity,
    {
      testID: testID ?? "apple-pay-button",
      onPress: () => onPayment(defaultMockResult),
    },
    React.createElement(Text, null, "Mock Apple Pay"),
  ),
);
