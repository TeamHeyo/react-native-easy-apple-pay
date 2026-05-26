import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

// Codegen spec for TurboModule (new architecture).
// Types are kept in sync with src/types.ts. Codegen requires primitive object shapes
// rather than imported type aliases, so we re-declare the shapes here.

export interface Spec extends TurboModule {
  canMakePayments(): Promise<boolean>;
  canMakePaymentsWithNetworks(networks: string[]): Promise<boolean>;
  requestPayment(params: Object): Promise<Object>;
  completePayment(success: boolean): Promise<void>;
  dismissPayment(): Promise<void>;
  updateShippingMethods(items: Object[], shippingMethods: Object[]): Promise<void>;
  updateShippingMethodsWithError(errorMessage: string): Promise<void>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>("RNEasyApplePay");
