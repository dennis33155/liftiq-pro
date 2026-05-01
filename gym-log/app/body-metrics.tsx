import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SimpleLineChart } from "@/components/SimpleLineChart";
import { useColors } from "@/hooks/useColors";
import {
  addBodyMetric,
  deleteBodyMetric,
  loadBodyMetrics,
  type BodyMetric,
} from "@/lib/bodyMetrics";

type ChartView = "weight" | "bodyFat";

function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const v = Number(trimmed);
  if (!Number.isFinite(v)) return null;
  if (v < 0) return null;
  return v;
}

function formatDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function BodyMetricsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [weightStr, setWeightStr] = useState("");
  const [bodyFatStr, setBodyFatStr] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<ChartView>("weight");
  const [chartWidth, setChartWidth] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    loadBodyMetrics()
      .then((res) => {
        if (alive) {
          setMetrics(res);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleAdd = useCallback(async () => {
    if (submitting) return;
    const weight = parseNumber(weightStr);
    const bodyFat = parseNumber(bodyFatStr);
    if (weight == null && bodyFat == null) {
      Alert.alert(
        "Need a value",
        "Enter a body weight or body fat percentage to log.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const next = await addBodyMetric({
        date: Date.now(),
        weightLb: weight,
        bodyFatPct: bodyFat,
        note: note.trim() || undefined,
      });
      setMetrics(next);
      setWeightStr("");
      setBodyFatStr("");
      setNote("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch {
      Alert.alert("Could not save", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, weightStr, bodyFatStr, note]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Delete entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteBodyMetric(id)
            .then(setMetrics)
            .catch(() => {});
        },
      },
    ]);
  }, []);

  const points = useMemo(() => {
    const sorted = [...metrics].sort((a, b) => a.date - b.date);
    if (view === "weight") {
      return sorted
        .filter((m) => m.weightLb != null && m.weightLb > 0)
        .map((m) => ({ x: m.date, y: m.weightLb as number }));
    }
    return sorted
      .filter((m) => m.bodyFatPct != null && m.bodyFatPct > 0)
      .map((m) => ({ x: m.date, y: m.bodyFatPct as number }));
  }, [metrics, view]);

  const latest = metrics[0] ?? null;

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
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 4 }}>
        <Text style={[styles.kicker, { color: colors.primary }]}>
          BODY METRICS
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Weight {"\u00B7"} Body Fat
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Log body composition and watch the trend over time.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.toggleRow}>
          {(["weight", "bodyFat"] as ChartView[]).map((v) => {
            const active = v === view;
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={({ pressed }) => [
                  styles.toggleChip,
                  {
                    backgroundColor: active ? colors.primary : "transparent",
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {v === "weight" ? "WEIGHT (LB)" : "BODY FAT %"}
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
              xFormatter={formatDateShort}
              yFormatter={(v) =>
                view === "weight" ? v.toFixed(0) : v.toFixed(1)
              }
            />
          ) : (
            <View style={{ height: 200 }} />
          )}
        </View>

        {latest ? (
          <View style={styles.latestRow}>
            <Feather name="activity" size={14} color={colors.primary} />
            <Text style={[styles.latestText, { color: colors.foreground }]}>
              Latest:{" "}
              {latest.weightLb != null ? latest.weightLb + " lb" : "no weight"}
              {"  \u00B7  "}
              {latest.bodyFatPct != null
                ? latest.bodyFatPct.toFixed(1) + "% bf"
                : "no bf"}
              <Text style={{ color: colors.mutedForeground }}>
                {"  \u00B7  "}
                {formatDateShort(latest.date)}
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
          NEW ENTRY
        </Text>
        <View style={styles.inputRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Weight (lb)
            </Text>
            <TextInput
              value={weightStr}
              onChangeText={setWeightStr}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Body Fat %
            </Text>
            <TextInput
              value={bodyFatStr}
              onChangeText={setBodyFatStr}
              placeholder="0.0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
            />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Note (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="post-coffee, morning weigh-in, etc."
            placeholderTextColor={colors.mutedForeground}
            maxLength={140}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                color: colors.foreground,
                backgroundColor: colors.background,
              },
            ]}
          />
        </View>
        <PrimaryButton
          label={submitting ? "Saving..." : "Log Entry"}
          onPress={handleAdd}
          disabled={submitting}
          icon={
            <Feather name="plus" size={16} color={colors.primaryForeground} />
          }
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          HISTORY
        </Text>
        {!loaded ? (
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Loading...
          </Text>
        ) : metrics.length === 0 ? (
          <EmptyState
            icon="activity"
            title="No entries yet"
            description="Log your first weigh-in above to start a trend line."
          />
        ) : (
          <View style={{ gap: 6 }}>
            {metrics.map((m) => (
              <View
                key={m.id}
                style={[styles.histRow, { borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.histDate, { color: colors.foreground }]}>
                    {formatDateLong(m.date)}
                  </Text>
                  <Text style={[styles.histDetail, { color: colors.mutedForeground }]}>
                    {m.weightLb != null ? m.weightLb + " lb" : "--"}
                    {"  \u00B7  "}
                    {m.bodyFatPct != null ? m.bodyFatPct.toFixed(1) + "% bf" : "--"}
                  </Text>
                  {m.note ? (
                    <Text style={[styles.histNote, { color: colors.mutedForeground }]}>
                      {m.note}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleDelete(m.id)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.trashBtn,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <Feather name="trash-2" size={16} color={colors.primary} />
                </Pressable>
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
    lineHeight: 18,
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
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  latestRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  latestText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1,
  },
  input: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  histDate: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  histDetail: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  histNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
  trashBtn: {
    padding: 6,
  },
});
