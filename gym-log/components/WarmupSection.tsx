import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { WARMUP_EXERCISE_IDS, WARMUP_PRESETS } from "@/lib/schedule";

function getMaxReps(
  workouts: ReturnType<typeof useWorkout>["workouts"],
  exerciseId: string,
): number {
  let max = 0;
  for (const w of workouts) {
    if (w.endedAt == null) continue;
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        const reps = s.reps ?? 0;
        if (reps > max) max = reps;
      }
    }
  }
  return max;
}

export function WarmupSection() {
  const colors = useColors();
  const { workouts, allExercises } = useWorkout();

  const items = useMemo(() => {
    return WARMUP_EXERCISE_IDS.map((id) => {
      const ex = allExercises.find((e) => e.id === id);
      const fallbackReps = WARMUP_PRESETS[id]?.reps ?? 0;
      const historyMax = getMaxReps(workouts, id);
      const bestReps = historyMax > 0 ? historyMax : fallbackReps;
      return {
        id,
        name: ex?.name ?? id,
        bestReps,
      };
    });
  }, [allExercises, workouts]);

  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.header}>
        <Feather name="lock" size={14} color={colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          Warm-up
        </Text>
      </View>
      <View style={styles.row}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <Text
              style={[styles.exerciseName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.prText, { color: colors.primary }]}>
              PB: {item.bestReps} reps
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  prText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
