import React from "react";
import { StyleSheet, Text, View } from "react-native";

const SIZE_PRESET = {
  sm: { textSize: 26, markSize: 28, markCell: 10 },
  md: { textSize: 34, markSize: 36, markCell: 13 },
  lg: { textSize: 40, markSize: 42, markCell: 15 },
};

export default function Mallog24Logo({ size = "md", style = null }) {
  const preset = SIZE_PRESET[size] || SIZE_PRESET.md;

  return (
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel="mallog24 logo">
      <Text style={[styles.textMain, { fontSize: preset.textSize, lineHeight: Math.round(preset.textSize * 0.92) }]}>mall</Text>

      <View
        style={[
          styles.mark,
          {
            width: preset.markSize,
            height: preset.markSize,
            borderRadius: Math.round(preset.markSize / 2),
            padding: Math.max(3, Math.round(preset.markSize * 0.12)),
          },
        ]}
      >
        <View style={styles.markRow}>
          <View style={[styles.markCell, { width: preset.markCell, height: preset.markCell }, styles.markCellLight]} />
          <View style={[styles.markCell, { width: preset.markCell, height: preset.markCell }, styles.markCellBlue]} />
        </View>
        <View style={styles.markRow}>
          <View style={[styles.markCell, { width: preset.markCell, height: preset.markCell }, styles.markCellBlue]} />
          <View style={[styles.markCell, { width: preset.markCell, height: preset.markCell }, styles.markCellLight]} />
        </View>
      </View>

      <Text style={[styles.textMain, { fontSize: preset.textSize, lineHeight: Math.round(preset.textSize * 0.92) }]}>g</Text>
      <Text style={[styles.textAccent, { fontSize: preset.textSize, lineHeight: Math.round(preset.textSize * 0.92) }]}>24</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  textMain: {
    color: "#1E2A44",
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  textAccent: {
    color: "#2EA3F2",
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  mark: {
    backgroundColor: "#1E2A44",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
    marginBottom: 3,
  },
  markRow: {
    flexDirection: "row",
    gap: 2,
  },
  markCell: {
    borderRadius: 1,
  },
  markCellLight: {
    backgroundColor: "#ffffff",
  },
  markCellBlue: {
    backgroundColor: "#2EA3F2",
  },
});
