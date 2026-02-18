import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function NmPressable({
  style,
  onPress,
  disabled,
  children,
  scaleDown = 0.96,
  ...rest
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scaleDown,
      friction: 6,
      tension: 240,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 210,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
