import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseImage } from "@/components/ExerciseImage";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { formatDate } from "@/lib/format";
import {
  workoutDurationMinutes,
  workoutVolume,
} from "@/lib/progression";

export default function WorkoutDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, allExercises, deleteWorkout } = useWorkout();

  const workout = workouts.find((w) => w.id === id);

  if (!workout) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          },
        ]}
      >
        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
          Workout not found.
        </Text>
      </View>
    );
  }

  const volume = Math.round(workoutVolume(workout));
  const minutes = workoutDurationMinutes(workout);
  const totalSets = workout.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.done).length,
    0,
  );

  const handleDelete = () => {
    Alert.alert("Delete workout?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteWorkout(workout.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Text style={[styles.category, { color: colors.foreground }]}>
        {workout.category}
      </Text>
      <Text style={[styles.date, { color: colors.mutedForeground }]}>
        {formatDate(workout.startedAt)}
      </Text>

      <View
        style={[
          styles.statsRow,
          { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        ]}
      >
        <Stat label="Sets" value={totalSets.toString()} />
        <Divider />
        <Stat label="Volume" value={`${volume.toLocaleString()} lb`} />
        {minutes > 0 ? (
          <>
            <Divider />
            <Stat label="Time" value={`${minutes}m`} />
          </>
        ) : null}
      </View>

      {workout.exercises.map((we) => {
        const ex = allExercises.find((e) => e.id === we.exerciseId);
        const completed = we.sets.filter((s) => s.done);
        return (
          <View
            key={we.id}
            style={[
              styles.exBlock,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <View style={styles.exHeader}>
              <ExerciseImage size={36} />
              <Text style={[styles.exName, { color: colors.foreground }]}>
                {ex?.name ?? "Exercise"}
              </Text>
            </View>
            {completed.length === 0 ? (
              <Text style={[styles.noSets, { color: colors.mutedForeground }]}>
                No completed sets.
              </Text>
            ) : (
              completed.map((s, i) => (
                <View key={s.id} style={styles.setLine}>
                  <Text style={[styles.setIdx, { color: colors.mutedForeground }]}>
                    {i + 1}
                  </Text>
                  <Text style={[styles.setText, { color: colors.foreground }]}>
                    {s.weight === 0 ? "BW" : `${s.weight ?? 0} lb`}{" "}
                    <Text style={{ color: colors.mutedForeground }}>x</Text>{" "}
                    {s.reps ?? 0} reps
                  </Text>
                </View>
              ))
            )}
          </View>
        );
      })}

      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [
          styles.dangerBtn,
          {
            borderColor: colors.destructive,
            borderRadius: colors.radius,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Feather name="trash-2" size={18} color={colors.destructive} />
        <Text style={[styles.dangerLabel, { color: colors.destructive }]}>
          Delete Workout
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View style={[styles.vDiv, { backgroundColor: colors.border }]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  category: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  date: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  vDiv: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  exBlock: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  exHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  exName: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  noSets: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
  },
  setLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  setIdx: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    width: 22,
    textAlign: "center",
  },
  setText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  dangerBtn: {
    marginTop: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
