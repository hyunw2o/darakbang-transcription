import React from "react";
import { StyleSheet, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import NmPressable from "./NmPressable";

export default function SegmentButton({ label, active, onPress, theme, icon, compact = false, disabled = false }) {
  return (
    <NmPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.button,
        compact ? styles.compact : null,
        { borderColor: theme.inputBorder },
        active
          ? { backgroundColor: theme.surface, borderColor: theme.accent }
          : { backgroundColor: "transparent" },
        disabled ? { opacity: 0.5 } : null,
      ]}
      scaleDown={0.95}
    >
      {icon ? <Feather name={icon} size={18} color={active ? theme.accent : theme.textSecondary} /> : null}
      <Text
        style={[
          styles.buttonText,
          { color: theme.textSecondary },
          active ? { color: theme.accent } : null,
        ]}
      >
        {label}
      </Text>
    </NmPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 88,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    gap: 5,
  },
  compact: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    paddingHorizontal: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    letterSpacing: 0,
    textAlign: "center",
  },
});
