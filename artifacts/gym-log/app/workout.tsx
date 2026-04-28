import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { ExerciseImage } from "@/components/ExerciseImage";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RestTimer } from "@/components/RestTimer";
import { SetRow } from "@/components/SetRow";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { formatTimer } from "@/lib/format";
import { getLastPerformance, suggestNext } from "@/lib/progression";
import type { WorkoutExercise } from "@/lib/types";

export default function WorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    active,
    workouts,
    allExercises,
    endWorkout,
    cancelWorkout,
    addSetToExercise,
    updateSet,
    removeSet,
    removeExerciseFromActive,
  } = useWorkout();

  const [elapsed, setElapsed] = useState(0);
  const [restVisible, setRestVisible] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);

  useEffect(() => {
    if (!active) {
      router.replace("/");
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      setElapsed(Math.floor((Date.now() - active.startedAt) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const completedSets = active.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.done).length,
    0,
  );
  const totalSets = active.exercises.reduce((acc, e) => acc + e.sets.length, 0);

  const handleFinish = () => {
    if (completedSets === 0) {
      Alert.alert(
        "Nothing logged",
        "Mark at least one set as done, or cancel the workout.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    endWorkout();
    router.replace("/history");
  };

  const handleCancel = () => {
    Alert.alert("Cancel workout?", "This will discard all current sets.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          cancelWorkout();
          router.replace("/");
        },
      },
    ]);
  };

  const startRest = (seconds: number) => {
    setRestSeconds(seconds);
    setRestVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={handleCancel}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Feather name="x" size={24} color={colors.foreground} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {active.category}
          </Text>
          <Text style={[styles.headerTimer, { color: colors.mutedForeground }]}>
            {formatTimer(elapsed)} {"\u00B7"} {completedSets}/{totalSets} sets
          </Text>
        </View>

        <Pressable
          onPress={() => startRest(restSeconds)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.timerBtn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="clock" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        {active.exercises.length === 0 ? (
          <View style={{ minHeight: 320 }}>
            <EmptyState
              icon="plus-circle"
              title="No exercises yet"
              description="Add an exercise to start logging sets."
            />
          </View>
        ) : (
          active.exercises.map((we) => (
            <ExerciseBlock
              key={we.id}
              we={we}
              allExercises={allExercises}
              workouts={workouts}
              onUpdate={(setId, patch) => {
                updateSet(we.id, setId, patch);
                if (patch.done === true) {
                  startRest(90);
                }
              }}
              onAddSet={() => addSetToExercise(we.id)}
              onRemoveSet={(setId) => removeSet(we.id, setId)}
              onRemove={() => {
                Alert.alert(
                  "Remove exercise?",
                  "This will remove all sets for this exercise.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => removeExerciseFromActive(we.id),
                    },
                  ],
                );
              }}
            />
          ))
        )}

        <PrimaryButton
          label="Add Exercise"
          variant="ghost"
          icon={<Feather name="plus" size={18} color={colors.foreground} />}
          onPress={() => router.push("/exercise-picker")}
          style={{ marginTop: 12 }}
        />
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <PrimaryButton
          label="Finish Workout"
          onPress={handleFinish}
          icon={
            <Feather name="check" size={18} color={colors.primaryForeground} />
          }
        />
      </View>

      <RestTimer
        visible={restVisible}
        initialSeconds={restSeconds}
        onClose={() => setRestVisible(false)}
      />
    </View>
  );
}

function ExerciseBlock({
  we,
  allExercises,
  workouts,
  onUpdate,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  we: WorkoutExercise;
  allExercises: ReturnType<typeof useWorkout>["allExercises"];
  workouts: ReturnType<typeof useWorkout>["workouts"];
  onUpdate: (
    setId: string,
    patch: Partial<WorkoutExercise["sets"][number]>,
  ) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const exercise = allExercises.find((e) => e.id === we.exerciseId);
  const last = useMemo(
    () => getLastPerformance(workouts, we.exerciseId),
    [workouts, we.exerciseId],
  );
  const suggestion = useMemo(() => suggestNext(last), [last]);

  if (!exercise) return null;

  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.blockHeader}>
        <ExerciseImage size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.exName, { color: colors.foreground }]}>
            {exercise.name}
          </Text>
          <Text
            style={[styles.exHint, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {suggestion.hint}
          </Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View
        style={[
          styles.suggestionPill,
          { backgroundColor: colors.accent, borderRadius: 8 },
        ]}
      >
        <Feather name="target" size={12} color={colors.primary} />
        <Text style={[styles.suggestionText, { color: colors.foreground }]}>
          Try{" "}
          <Text style={{ fontFamily: "Inter_700Bold" }}>
            {suggestion.weight}
          </Text>{" "}
          lb x{" "}
          <Text style={{ fontFamily: "Inter_700Bold" }}>{suggestion.reps}</Text>
        </Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.colHead, styles.colSet, { color: colors.mutedForeground }]}>
          SET
        </Text>
        <Text style={[styles.colHead, styles.colInput, { color: colors.mutedForeground }]}>
          WEIGHT
        </Text>
        <Text style={[styles.colHead, styles.colInput, { color: colors.mutedForeground }]}>
          REPS
        </Text>
        <View style={styles.colDone} />
        <View style={styles.colDel} />
      </View>

      {we.sets.map((s, idx) => (
        <SetRow
          key={s.id}
          index={idx}
          set={s}
          onChange={(patch) => onUpdate(s.id, patch)}
          onDelete={() => onRemoveSet(s.id)}
        />
      ))}

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onAddSet();
        }}
        style={({ pressed }) => [
          styles.addSetBtn,
          {
            borderColor: colors.border,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Feather name="plus" size={14} color={colors.mutedForeground} />
        <Text
          style={[styles.addSetLabel, { color: colors.mutedForeground }]}
        >
          Add Set
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  headerTimer: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  timerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  block: {
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  exName: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  exHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  suggestionPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  suggestionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 6,
    marginBottom: 4,
    gap: 8,
  },
  colHead: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
  },
  colSet: { width: 22, textAlign: "center" },
  colInput: { flex: 1, paddingLeft: 4 },
  colDone: { width: 40 },
  colDel: { width: 28 },
  addSetBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  addSetLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
