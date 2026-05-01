import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  primary?: string[];
  secondary?: string[];
  compact?: boolean;
};

export function MuscleChips({ primary, secondary, compact = false }: Props) {
  const colors = useColors();
  const hasPrimary = primary && primary.length > 0;
  const hasSecondary = secondary && secondary.length > 0;
  if (!hasPrimary && !hasSecondary) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {hasPrimary ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.primary }]}>PRIMARY</Text>
          <View style={styles.chips}>
            {primary!.map((m) => (
              <View
                key={"p-" + m}
                style={[
                  compact ? styles.chipCompact : styles.chip,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    compact ? styles.chipTextCompact : styles.chipText,
                    { color: colors.primaryForeground },
                  ]}
                  numberOfLines={1}
                >
                  {m}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {hasSecondary ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            SECONDARY
          </Text>
          <View style={styles.chips}>
            {secondary!.map((m) => (
              <View
                key={"s-" + m}
                style={[
                  compact ? styles.chipCompact : styles.chip,
                  {
                    backgroundColor: "transparent",
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    compact ? styles.chipTextCompact : styles.chipText,
                    { color: colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {m}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  wrapCompact: {
    gap: 4,
  },
  row: {
    gap: 6,
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  chipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipTextCompact: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
});
