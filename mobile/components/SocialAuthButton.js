import React from "react";
import { StyleSheet, Text, View } from "react-native";
import NmPressable from "./NmPressable";

function ProviderMark({ provider }) {
  if (provider === "apple") {
    return (
      <View style={styles.appleMarkWrap}>
        <Text style={styles.appleMarkText}>A</Text>
      </View>
    );
  }

  if (provider === "google") {
    return (
      <View style={styles.googleMarkWrap}>
        <Text style={styles.googleMarkText}>G</Text>
      </View>
    );
  }

  return (
    <View style={styles.kakaoMarkWrap}>
      <Text style={styles.kakaoMarkText}>K</Text>
    </View>
  );
}

export default function SocialAuthButton({ provider, label, loading, loadingLabel, onPress, disabled }) {
  const isGoogle = provider === "google";
  const isApple = provider === "apple";
  return (
    <NmPressable
      style={[
        styles.button,
        isApple ? styles.appleButton : isGoogle ? styles.googleButton : styles.kakaoButton,
        disabled ? styles.disabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.inner}>
        <ProviderMark provider={provider} />
        <Text style={[styles.label, isApple ? styles.appleLabel : isGoogle ? styles.googleLabel : styles.kakaoLabel]}>
          {loading ? loadingLabel || label : label}
        </Text>
      </View>
    </NmPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: "#ffffff",
    borderColor: "#dadce0",
  },
  appleButton: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  kakaoButton: {
    backgroundColor: "#FEE500",
    borderColor: "#e6cf00",
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleMarkWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dadce0",
    alignItems: "center",
    justifyContent: "center",
  },
  googleMarkText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4285F4",
  },
  appleMarkWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  appleMarkText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111827",
  },
  kakaoMarkWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#191919",
    alignItems: "center",
    justifyContent: "center",
  },
  kakaoMarkText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FEE500",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
  },
  googleLabel: {
    color: "#1f1f1f",
  },
  appleLabel: {
    color: "#ffffff",
  },
  kakaoLabel: {
    color: "#191919",
  },
});
