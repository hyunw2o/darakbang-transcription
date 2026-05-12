import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import {
  deepLinkToSubscriptions,
  getAvailablePurchases,
  getReceiptDataIOS,
  requestReceiptRefreshIOS,
  useIAP,
} from "expo-iap";
import { APPLE_IAP_PRODUCT_ID_PRO } from "../config";
import { requestApi } from "../utils/network";
import NmPressable from "./NmPressable";

async function readAppleReceiptData() {
  try {
    const receipt = await getReceiptDataIOS();
    if (receipt) return receipt;
  } catch {
    // A refresh below can still recover the receipt on a real App Store build.
  }

  try {
    return await requestReceiptRefreshIOS();
  } catch {
    return "";
  }
}

function findProSubscription(subscriptions) {
  return (subscriptions || []).find(
    (item) => item?.id === APPLE_IAP_PRODUCT_ID_PRO || item?.productId === APPLE_IAP_PRODUCT_ID_PRO,
  );
}

export default function AppleIapSubscriptionCard({
  copy,
  activeTheme,
  authToken,
  fetchUsage,
  setNotice,
  setError,
}) {
  const [busyAction, setBusyAction] = useState("");
  const verifyingRef = useRef(false);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      await verifyPurchaseWithServer(purchase, "purchase");
    },
    onPurchaseError: (error) => {
      setBusyAction("");
      const message = String(error?.message || "");
      if (/cancel|user/i.test(message)) return;
      setError(message || copy.appleIapPurchaseFailed);
    },
  });

  const product = useMemo(() => findProSubscription(subscriptions), [subscriptions]);
  const productPrice = product?.displayPrice || copy.appleIapProductPending;

  useEffect(() => {
    if (Platform.OS !== "ios" || !connected || !APPLE_IAP_PRODUCT_ID_PRO) return;
    fetchProducts({ skus: [APPLE_IAP_PRODUCT_ID_PRO], type: "subs" }).catch((error) => {
      setError(error?.message || copy.appleIapUnavailable);
    });
  }, [connected, copy.appleIapUnavailable, fetchProducts, setError]);

  const verifyPurchaseWithServer = useCallback(async (purchase, source = "purchase") => {
    if (!purchase || verifyingRef.current || !authToken) return;
    verifyingRef.current = true;
    setBusyAction(source);

    try {
      const receiptData = await readAppleReceiptData();
      const data = await requestApi("/api/billing/apple/verify", {
        method: "POST",
        token: authToken,
        timeoutMs: 45000,
        body: JSON.stringify({
          product_id: purchase.productId || APPLE_IAP_PRODUCT_ID_PRO,
          transaction_id: purchase.transactionId || purchase.id || "",
          original_transaction_id: purchase.originalTransactionIdentifierIOS || "",
          purchase_token: purchase.purchaseToken || "",
          receipt_data: receiptData || "",
          environment: purchase.environmentIOS || "",
          expiration_date_ms: purchase.expirationDateIOS || null,
        }),
      });

      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Verification is the entitlement source; finishing failure should not hide success.
      }

      await fetchUsage(authToken, { quiet: true });
      setNotice(data?.plan_tier === "pro" ? copy.appleIapPurchaseVerified : copy.appleIapExpired);
    } catch (error) {
      setError(error?.message || copy.appleIapVerifyFailed);
    } finally {
      verifyingRef.current = false;
      setBusyAction("");
    }
  }, [
    authToken,
    copy.appleIapExpired,
    copy.appleIapPurchaseVerified,
    copy.appleIapVerifyFailed,
    fetchUsage,
    finishTransaction,
    setError,
    setNotice,
  ]);

  const handleSubscribe = useCallback(async () => {
    if (!product) {
      setError(copy.appleIapUnavailable);
      return;
    }
    setBusyAction("subscribe");
    try {
      const result = await requestPurchase({
        type: "subs",
        request: {
          apple: { sku: APPLE_IAP_PRODUCT_ID_PRO },
        },
      });
      const purchase = Array.isArray(result) ? result[0] : result;
      if (purchase) {
        await verifyPurchaseWithServer(purchase, "purchase");
      } else {
        setNotice(copy.appleIapPurchaseStarted);
      }
    } catch (error) {
      const message = String(error?.message || "");
      if (!/cancel|user/i.test(message)) {
        setError(message || copy.appleIapPurchaseFailed);
      }
    } finally {
      setBusyAction("");
    }
  }, [
    copy.appleIapPurchaseFailed,
    copy.appleIapPurchaseStarted,
    copy.appleIapUnavailable,
    product,
    requestPurchase,
    setError,
    setNotice,
    verifyPurchaseWithServer,
  ]);

  const handleRestore = useCallback(async () => {
    setBusyAction("restore");
    try {
      const purchases = await getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });
      const purchase = (purchases || []).find(
        (item) => item?.productId === APPLE_IAP_PRODUCT_ID_PRO || item?.id === APPLE_IAP_PRODUCT_ID_PRO,
      );
      if (!purchase) {
        setNotice(copy.appleIapNoRestorablePurchase);
        return;
      }
      await verifyPurchaseWithServer(purchase, "restore");
      setNotice(copy.appleIapRestoreDone);
    } catch (error) {
      setError(error?.message || copy.appleIapVerifyFailed);
    } finally {
      setBusyAction("");
    }
  }, [
    copy.appleIapNoRestorablePurchase,
    copy.appleIapRestoreDone,
    copy.appleIapVerifyFailed,
    setError,
    setNotice,
    verifyPurchaseWithServer,
  ]);

  const handleManage = useCallback(() => {
    deepLinkToSubscriptions({}).catch((error) => {
      setError(error?.message || copy.appleIapManageFailed);
    });
  }, [copy.appleIapManageFailed, setError]);

  if (Platform.OS !== "ios" || !APPLE_IAP_PRODUCT_ID_PRO || !authToken) {
    return null;
  }

  const isBusy = !!busyAction;

  return (
    <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: activeTheme.textPrimary }]}>{copy.appleIapTitle}</Text>
          <Text style={[styles.hint, { color: activeTheme.textSecondary }]}>{copy.appleIapHint}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
          <Text style={[styles.statusText, { color: connected ? activeTheme.accent : activeTheme.textSecondary }]}>
            {connected ? copy.appleIapConnected : copy.appleIapDisconnected}
          </Text>
        </View>
      </View>

      <View style={[styles.productBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
        <Text style={[styles.productName, { color: activeTheme.textPrimary }]}>
          {product?.title || copy.appleIapProductName}
        </Text>
        <Text style={[styles.price, { color: activeTheme.accent }]}>{productPrice}</Text>
      </View>

      {!product ? (
        <Text style={[styles.hint, { color: activeTheme.textSecondary }]}>{copy.appleIapUnavailable}</Text>
      ) : null}

      <View style={styles.actionRow}>
        <NmPressable
          style={[
            styles.primaryButton,
            { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
            isBusy || !product ? styles.disabled : null,
          ]}
          onPress={handleSubscribe}
          disabled={isBusy || !product}
        >
          <Text style={styles.primaryButtonText}>
            {busyAction === "subscribe" || busyAction === "purchase" ? copy.processing : copy.appleIapSubscribe}
          </Text>
        </NmPressable>

        <NmPressable
          style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, isBusy ? styles.disabled : null]}
          onPress={handleRestore}
          disabled={isBusy}
        >
          <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>
            {busyAction === "restore" ? copy.processing : copy.appleIapRestore}
          </Text>
        </NmPressable>
      </View>

      <NmPressable
        style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
        onPress={handleManage}
      >
        <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.appleIapManage}</Text>
      </NmPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  productBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: "800",
  },
  price: {
    fontSize: 18,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    flexGrow: 1,
    flexBasis: "58%",
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});
