import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
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
import { describeFreshness } from "@/lib/recommendation";
import {
  getLastPerformance,
  getPersonalBest,
  suggestNext,
} from "@/lib/progression";

type Tab = "Primary" | "Secondary";

export default function ExerciseDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allExercises, workouts, active, addExerciseToActive } = useWorkout();
  const [tab, setTab] = useState<Tab>("Primary");

  const exerciseId = typeof id === "string" ? id : null;
  const exercise = exerciseId
    ? allExercises.find((e) => e.id === exerciseId)
    : undefined;
  const [imageOpen, setImageOpen] = useState(false);

  if (!exercise) {
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
        <Text
          style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}
        >
          Exercise not found.
        </Text>
      </View>
    );
  }

  const last = getLastPerformance(workouts, exercise.id);
  const pb = getPersonalBest(workouts, exercise.id, active);
  const suggestion = suggestNext(last, pb);
  const freshness = describeFreshness(exercise.id, workouts);

  const muscles =
    tab === "Primary"
      ? exercise.primaryMuscles ?? []
      : exercise.secondaryMuscles ?? [];

  const handleAdd = () => {
    if (!active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addExerciseToActive(exercise.id);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: active ? 100 : insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setImageOpen(true);
          }}
          accessibilityLabel={`Open ${exercise.name} visual guide`}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <ExerciseImage
            exercise={exercise}
            large
            showPlaceholderCaption
          />
        </Pressable>
        <View style={styles.visualGuideRow}>
          <Feather name="image" size={12} color={colors.mutedForeground} />
          <Text
            style={[styles.visualGuideText, { color: colors.mutedForeground }]}
          >
            Visual guide {"\u00B7"} tap to enlarge
          </Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {exercise.name}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
          >
            {exercise.category}
            {exercise.equipment ? "  \u00B7  " + exercise.equipment : ""}
          </Text>
        </View>

        <View
          style={[
            styles.statRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.statCol}>
            <Text
              style={[styles.statLabel, { color: colors.mutedForeground }]}
            >
              LAST
            </Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {last
                ? (last.weight === 0 ? "BW" : last.weight + " lb") +
                  " x " +
                  last.reps
                : "Never"}
            </Text>
          </View>
          <View style={[styles.vDiv, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text
              style={[styles.statLabel, { color: colors.mutedForeground }]}
            >
              SUGGEST
            </Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {suggestion.weight === 0 ? "BW" : suggestion.weight + " lb"} x{" "}
              {suggestion.reps}
            </Text>
          </View>
          <View style={[styles.vDiv, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text
              style={[styles.statLabel, { color: colors.mutedForeground }]}
            >
              HISTORY
            </Text>
            <Text
              style={[styles.statValue, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {freshness}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.suggestPill,
            { backgroundColor: colors.accent, borderRadius: 10 },
          ]}
        >
          <Feather name="target" size={14} color={colors.primary} />
          <Text style={[styles.suggestText, { color: colors.foreground }]}>
            {suggestion.hint}
          </Text>
        </View>

        {exercise.preparation ? (
          <Section title="Preparation" body={exercise.preparation} />
        ) : null}
        {exercise.execution ? (
          <Section title="Execution" body={exercise.execution} />
        ) : null}
        {exercise.tip ? (
          <Section title="Comment" body={exercise.tip} />
        ) : null}

        <View
          style={[
            styles.muscleCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <View style={styles.tabRow}>
            {(["Primary", "Secondary"] as Tab[]).map((t) => {
              const selected = tab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTab(t);
                  }}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      borderBottomColor: selected
                        ? colors.primary
                        : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: selected
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: selected
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                      },
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={styles.muscleScroll}
            contentContainerStyle={{ paddingVertical: 8 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {muscles.length === 0 ? (
              <Text
                style={[
                  styles.muscleEmpty,
                  { color: colors.mutedForeground },
                ]}
              >
                No {tab.toLowerCase()} muscles listed for this exercise.
              </Text>
            ) : (
              muscles.map((m, i) => (
                <View key={m + i} style={styles.muscleRow}>
                  <View
                    style={[
                      styles.bullet,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                  <Text
                    style={[styles.muscleText, { color: colors.foreground }]}
                  >
                    {m}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>

      <Modal
        visible={imageOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setImageOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setImageOpen(false)}
            accessibilityLabel="Close visual guide"
          />
          <View style={styles.viewerImageWrap} pointerEvents="box-none">
            <ExerciseImage
              exercise={exercise}
              large
              contain
              showPlaceholderCaption
            />
            <Text style={styles.viewerCaption}>{exercise.name}</Text>
          </View>
          <View
            pointerEvents="box-none"
            style={[
              styles.viewerTopBar,
              { paddingTop: insets.top + 8 },
            ]}
          >
            <Pressable
              onPress={() => setImageOpen(false)}
              hitSlop={10}
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.viewerNavPill,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="chevron-left" size={18} color="#fafafa" />
              <Text style={styles.viewerNavText}>Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {active ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable
            onPress={handleAdd}
            style={({ pressed }) => [
              styles.addBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text
              style={[
                styles.addLabel,
                { color: colors.primaryForeground },
              ]}
            >
              Add to Workout
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text
        style={[styles.sectionTitle, { color: colors.mutedForeground }]}
      >
        {title.toUpperCase()}
      </Text>
      <Text style={[styles.sectionBody, { color: colors.foreground }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  visualGuideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: -6,
    marginBottom: 14,
  },
  visualGuideText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  viewerImageWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 88,
    paddingBottom: 32,
    alignItems: "stretch",
    justifyContent: "center",
    gap: 12,
  },
  viewerCaption: {
    color: "#fafafa",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textAlign: "center",
    opacity: 0.85,
  },
  viewerTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  viewerNavPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,22,0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  viewerNavText: {
    color: "#fafafa",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  titleBlock: {
    marginBottom: 18,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
  },
  statRow: {
    flexDirection: "row",
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  statLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  vDiv: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  suggestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  suggestText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  muscleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginTop: 4,
  },
  tabRow: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  muscleScroll: {
    maxHeight: 220,
    paddingHorizontal: 16,
  },
  muscleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  muscleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flex: 1,
  },
  muscleEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  addLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
});
