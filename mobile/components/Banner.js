import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FadeInView from "./FadeInView";

export default function Banner({ type = "notice", text }) {
  if (!text) return null;
  return (
    <FadeInView duration={300}>
      <View style={[styles.banner, type === "error" ? styles.bannerError : styles.bannerNotice]}>
        <Text style={[styles.bannerText, type === "error" ? styles.bannerTextError : styles.bannerTextNotice]}>
          {text}
        </Text>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  bannerError: {
    backgroundColor: "#fdeceb",
    borderColor: "#f3b7b2",
  },
  bannerNotice: {
    backgroundColor: "#ecf3ff",
    borderColor: "#bfd0ff",
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  bannerTextError: {
    color: "#b4233a",
  },
  bannerTextNotice: {
    color: "#2458d3",
  },
});
