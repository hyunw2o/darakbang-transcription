import React from "react";
import { StyleSheet, Text } from "react-native";
import NmPressable from "./NmPressable";

export default function SegmentButton({ label, active, onPress, theme }) {
  return (
    <NmPressable
      onPress={onPress}
      style={[
        styles.button,
        { borderColor: theme.inputBorder },
        active
          ? [styles.buttonActive, { backgroundColor: theme.bg, shadowColor: theme.dark }]
          : { backgroundColor: "transparent" },
      ]}
      scaleDown={0.95}
    >
      <Text
        style={[
          styles.buttonText,
          { color: theme.textSecondary },
          active ? [styles.buttonTextActive, { color: theme.accent }] : null,
        ]}
      >
        {label}
      </Text>
    </NmPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  buttonTextActive: {
    letterSpacing: 0.2,
  },
});
