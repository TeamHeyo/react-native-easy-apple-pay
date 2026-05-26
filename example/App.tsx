import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ApplePayButton,
  ApplePayProvider,
  type PaymentItem,
  type PaymentResult,
} from "react-native-easy-apple-pay";

// Replace with your real merchant identifier. Must match the entitlement in app.json.
const MERCHANT_ID = "merchant.com.example.easyapplepay";

const items: PaymentItem[] = [
  { label: "Blue T-Shirt", amount: "29.99" },
  { label: "Your Store", amount: "29.99" },
];

const config = {
  merchantIdentifier: MERCHANT_ID,
  countryCode: "US",
  currencyCode: "USD",
};

// Pretend server endpoint. Replace with your real charge call.
async function chargeOnServer(token: string): Promise<boolean> {
  // eslint-disable-next-line no-console
  console.log("Server would charge token:", token.slice(0, 24), "…");
  await new Promise((r) => setTimeout(r, 500));
  return true;
}

export default function App() {
  const [lastResult, setLastResult] = useState<PaymentResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  return (
    <ApplePayProvider config={config}>
      <SafeAreaView style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>react-native-easy-apple-pay</Text>
          <Text style={styles.subtitle}>
            Tap to charge $29.99 via Apple Pay.{"\n"}
            Requires a real device + a card in Wallet.
          </Text>

          <ApplePayButton
            items={items}
            buttonType="buy"
            onPayment={async (result) => {
              setLastResult(result);
              const ok = await chargeOnServer(result.token);
              if (!ok) Alert.alert("Charge failed");
              return ok;
            }}
            onError={(err) => {
              setLastError(err.message);
              Alert.alert("Apple Pay error", err.message);
            }}
          />

          {lastResult && (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>Last payment</Text>
              <Text style={styles.resultBody}>
                txn: {lastResult.transactionIdentifier}
                {"\n"}network: {lastResult.paymentMethod.network}
                {"\n"}card: {lastResult.paymentMethod.displayName}
              </Text>
            </View>
          )}

          {lastError && (
            <Text style={styles.error}>Error: {lastError}</Text>
          )}
        </View>
      </SafeAreaView>
    </ApplePayProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f4f7",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 20,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  result: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
  },
  resultTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  resultBody: {
    fontFamily: "Menlo",
    fontSize: 12,
    color: "#333",
  },
  error: {
    color: "#b91c1c",
    fontSize: 13,
  },
});
