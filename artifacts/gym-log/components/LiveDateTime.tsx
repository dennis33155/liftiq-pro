import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  /**
   * "row" places the time and date side-by-side on one line (good for tab
   * page headers with extra space). "stack" stacks them vertically (good
   * for compact stack headerRight slots).
   */
  variant?: "row" | "stack";
  align?: "left" | "right" | "center";
  style?: ViewStyle;
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDay(d: Date): string {
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function LiveDateTime({
  variant = "stack",
  align = "right",
  style,
}: Props) {
  const colors = useColors();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Align ticks to the next minute boundary so the clock stays in sync.
    let interval: ReturnType<typeof setInterval> | null = null;
    const msToNextMinute =
      60_000 - (Date.now() - new Date().setSeconds(0, 0)) % 60_000;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, Math.max(50, msToNextMinute));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const clockText = formatClock(now);
  const dayText = formatDay(now);

  const alignItems =
    align === "left"
      ? "flex-start"
      : align === "center"
        ? "center"
        : "flex-end";

  if (variant === "row") {
    return (
      <View
        style={[
          styles.row,
          { alignItems: "center", justifyContent: alignItems },
          style,
        ]}
      >
        <Text style={[styles.clockRow, { color: colors.foreground }]}>
          {clockText}
        </Text>
        <Text style={[styles.dot, { color: colors.mutedForeground }]}>
          {"\u00B7"}
        </Text>
        <Text style={[styles.dayRow, { color: colors.mutedForeground }]}>
          {dayText}
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ alignItems }, style]}>
      <Text style={[styles.clockStack, { color: colors.foreground }]}>
        {clockText}
      </Text>
      <Text style={[styles.dayStack, { color: colors.mutedForeground }]}>
        {dayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
  clockRow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  dot: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  dayRow: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  clockStack: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  dayStack: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 0.3,
    lineHeight: 12,
    marginTop: 1,
  },
});
