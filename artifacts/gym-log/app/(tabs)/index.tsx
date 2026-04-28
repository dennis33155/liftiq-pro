import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryCard } from "@/components/CategoryCard";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { formatRelative } from "@/lib/format";
import { workoutVolume } from "@/lib/progression";
import { CATEGORIES } from "@/lib/types";
import type { Category } from "@/lib/types";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { active, startWorkout, workouts } = useWorkout();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? 84 + 16 : 100;

  const handleStart = (category: Category) => {
    if (active) {
      router.push("/workout");
      return;
    }
    startWorkout(category);
    router.push("/workout");
  };

  const todaysCount = workouts.filter((w) => {
    const d = new Date(w.startedAt);
    const t = new Date();
    return (
      d.getFullYear() === t.getFullYear() &&
      d.getMonth() === t.getMonth() &&
      d.getDate() === t.getDate()
    );
  }).length;

  const lastWorkout = workouts[0];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting()}
          </Text>
          <Text style={[styles.appName, { color: colors.foreground }]}>
            Gym Log
          </Text>
        </View>
        <View
          style={[
            styles.streakBadge,
            { backgroundColor: colors.accent, borderColor: colors.border },
          ]}
        >
          <Feather name="zap" size={14} color={colors.primary} />
          <Text style={[styles.streakText, { color: colors.foreground }]}>
            {workouts.length}
          </Text>
        </View>
      </View>

      {active ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/workout");
          }}
          style={({ pressed }) => [
            styles.activeCard,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius + 4,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <View style={styles.activeRow}>
            <View
              style={[
                styles.activeDot,
                { backgroundColor: colors.primaryForeground },
              ]}
            />
            <Text
              style={[
                styles.activeLabel,
                { color: colors.primaryForeground },
              ]}
            >
              ACTIVE WORKOUT
            </Text>
          </View>
          <Text
            style={[styles.activeTitle, { color: colors.primaryForeground }]}
          >
            {active.category}
          </Text>
          <View style={styles.activeMeta}>
            <Text
              style={[
                styles.activeMetaText,
                { color: colors.primaryForeground, opacity: 0.85 },
              ]}
            >
              {active.exercises.length}{" "}
              {active.exercises.length === 1 ? "exercise" : "exercises"}{" "}
              {"\u00B7"} started {formatRelative(active.startedAt).toLowerCase()}
            </Text>
            <Feather
              name="arrow-right"
              size={20}
              color={colors.primaryForeground}
            />
          </View>
        </Pressable>
      ) : (
        <View style={styles.statRow}>
          <StatTile
            label="Today"
            value={todaysCount.toString()}
            sub={todaysCount === 1 ? "session" : "sessions"}
          />
          <StatTile
            label="Last Lift"
            value={
              lastWorkout
                ? Math.round(workoutVolume(lastWorkout)).toLocaleString()
                : "0"
            }
            sub="lb volume"
          />
          <StatTile label="Total" value={workouts.length.toString()} sub="workouts" />
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        START A WORKOUT
      </Text>

      <View style={styles.categories}>
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat}
            category={cat}
            onPress={() => handleStart(cat)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        statStyles.tile,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[statStyles.value, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[statStyles.sub, { color: colors.mutedForeground }]}>
        {sub}
      </Text>
    </View>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  appName: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  activeCard: {
    marginHorizontal: 20,
    padding: 20,
    marginBottom: 24,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  activeTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    marginBottom: 8,
  },
  activeMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeMetaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  statRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categories: {
    paddingHorizontal: 20,
    gap: 10,
  },
});

const statStyles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginBottom: 2,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
});
