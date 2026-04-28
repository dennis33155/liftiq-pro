import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { formatRelative } from "@/lib/format";
import {
  workoutDurationMinutes,
  workoutVolume,
} from "@/lib/progression";
import type { Workout } from "@/lib/types";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workouts, loaded } = useWorkout();

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => b.startedAt - a.startedAt),
    [workouts],
  );

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? 84 + 16 : 100;

  if (loaded && sorted.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: topPad,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <View style={[styles.headerRow, { paddingHorizontal: 20 }]}>
          <Text style={[styles.h1, { color: colors.foreground }]}>History</Text>
        </View>
        <EmptyState
          icon="clock"
          title="No workouts yet"
          description="Finish your first workout and it will show up here."
        />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      data={sorted}
      keyExtractor={(w) => w.id}
      contentContainerStyle={{
        paddingTop: topPad + 8,
        paddingBottom: bottomPad,
        paddingHorizontal: 20,
      }}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <Text style={[styles.h1, { color: colors.foreground }]}>History</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {sorted.length} {sorted.length === 1 ? "workout" : "workouts"}
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => <WorkoutRow workout={item} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const colors = useColors();
  const volume = Math.round(workoutVolume(workout));
  const minutes = workoutDurationMinutes(workout);
  const totalSets = workout.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.done).length,
    0,
  );

  return (
    <Pressable
      onPress={() => router.push(`/workout-detail/${workout.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardCategory, { color: colors.foreground }]}>
          {workout.category}
        </Text>
        <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
          {formatRelative(workout.startedAt)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Meta icon="layers" value={`${workout.exercises.length} ex`} />
        <Meta icon="hash" value={`${totalSets} sets`} />
        <Meta icon="trending-up" value={`${volume.toLocaleString()} lb`} />
        {minutes > 0 ? (
          <Meta icon="clock" value={`${minutes}m`} />
        ) : null}
      </View>
      <View style={styles.chevWrap}>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

function Meta({
  icon,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  value: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={12} color={colors.mutedForeground} />
      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  h1: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  count: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardCategory: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  cardDate: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  chevWrap: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -9,
  },
});
