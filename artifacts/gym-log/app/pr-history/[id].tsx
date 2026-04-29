import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { SimpleLineChart } from "@/components/SimpleLineChart";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import {
  exerciseHistory,
  type ExerciseHistoryPoint,
} from "@/lib/exerciseHistory";

type Metric = "estimated1RM" | "bestWeight" | "totalVolume";

const METRIC_META: Record<
  Metric,
  { label: string; short: string; unit: string; pick: (p: ExerciseHistoryPoint) => number }
> = {
  estimated1RM: {
    label: "Estimated 1RM",
    short: "EST 1RM",
    unit: "lb",
    pick: (p) => p.estimated1RM,
  },
  bestWeight: {
    label: "Top set weight",
    short: "TOP SET",
    unit: "lb",
    pick: (p) => p.bestWeight,
  },
  totalVolume: {
    label: "Total volume",
    short: "VOLUME",
    unit: "lb",
    pick: (p) => p.totalVolume,
  },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PRHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, allExercises } = useWorkout();
  const [metric, setMetric] = useState<Metric>("estimated1RM");
  const [chartWidth, setChartWidth] = useState<number>(0);

  const exercise = useMemo(
    () => allExercises.find((e) => e.id === id) ?? null,
    [id, allExercises],
  );

  const history = useMemo(
    () => (id ? exerciseHistory(workouts, id) : []),
    [id, workouts],
  );

  const meta = METRIC_META[metric];
  const points = useMemo(
    () => history.map((h) => ({ x: h.date, y: meta.pick(h) })),
    [history, meta],
  );

  const peak = useMemo(() => {
    if (history.length === 0) return null;
    return [...history].sort((a, b) => meta.pick(b) - meta.pick(a))[0];
  }, [history, meta]);

  const onChartLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== chartWidth) setChartWidth(w);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: 16,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={[styles.kicker, { color: colors.primary }]}>
          PR HISTORY
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {exercise?.name ?? "Unknown exercise"}
        </Text>
        {exercise ? (
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {exercise.category} {"\u00B7"} {history.length}{" "}
            {history.length === 1 ? "session" : "sessions"} logged
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.metricRow}>
          {(Object.keys(METRIC_META) as Metric[]).map((m) => {
            const active = m === metric;
            return (
              <Pressable
                key={m}
                onPress={() => setMetric(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.metricChipWrap,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.metricChipText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {METRIC_META[m].short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View onLayout={onChartLayout}>
          {chartWidth > 0 ? (
            <SimpleLineChart
              data={points}
              width={chartWidth}
              height={200}
              yLabel={meta.label + " (" + meta.unit + ")"}
              xFormatter={formatDate}
              yFormatter={(v) =>
                v >= 1000
                  ? (v / 1000).toFixed(1) + "k"
                  : v.toFixed(meta.unit === "lb" && metric !== "estimated1RM" ? 0 : 1)
              }
            />
          ) : (
            <View style={{ height: 200 }} />
          )}
        </View>

        {peak ? (
          <View style={styles.peakRow}>
            <Feather name="award" size={14} color={colors.primary} />
            <Text style={[styles.peakText, { color: colors.foreground }]}>
              Peak {meta.short.toLowerCase()}: {meta.pick(peak).toFixed(1)} {meta.unit}{" "}
              <Text style={{ color: colors.mutedForeground }}>
                on {formatLongDate(peak.date)}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          SESSION LOG
        </Text>
        {history.length === 0 ? (
          <EmptyState
            icon="bar-chart-2"
            title="No history yet"
            description="Log a completed set in this exercise to see your trend appear here."
          />
        ) : (
          <View style={{ gap: 6 }}>
            {[...history].reverse().map((h) => (
              <View
                key={h.workoutId}
                style={[
                  styles.histRow,
                  { borderColor: colors.border },
                ]}
              >
                <Text style={[styles.histDate, { color: colors.foreground }]}>
                  {formatLongDate(h.date)}
                </Text>
                <View style={styles.histStats}>
                  <Text style={[styles.histStatNum, { color: colors.primary }]}>
                    {h.bestWeight} x {h.bestReps}
                  </Text>
                  <Text
                    style={[styles.histStatLabel, { color: colors.mutedForeground }]}
                  >
                    {h.estimated1RM.toFixed(1)} 1RM {"\u00B7"}{" "}
                    {h.totalVolume.toLocaleString()} vol
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cardLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricChipWrap: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  peakRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  peakText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  histRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  histDate: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  histStats: {
    alignItems: "flex-end",
  },
  histStatNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  histStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
});
