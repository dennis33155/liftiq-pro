import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  size?: number;
  letter?: string;
};

export function ExerciseImage({ size = 44, letter }: Props) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: colors.accent,
          borderColor: colors.border,
        },
      ]}
    >
      {letter ? null : (
        <Feather name="zap" size={size * 0.5} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
