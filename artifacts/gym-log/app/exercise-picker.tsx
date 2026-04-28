import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseImage } from "@/components/ExerciseImage";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { CATEGORIES } from "@/lib/types";
import type { Category, Exercise } from "@/lib/types";

export default function ExercisePicker() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { active, allExercises, addExerciseToActive } = useWorkout();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "All">(
    active?.category ?? "All",
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExercises
      .filter((e) => filter === "All" || e.category === filter)
      .filter((e) => (q === "" ? true : e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allExercises, query, filter]);

  const handleAdd = (exercise: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addExerciseToActive(exercise.id);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.input, borderRadius: 12 },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      <FlatList
        horizontal
        data={["All", ...CATEGORIES] as (Category | "All")[]}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        renderItem={({ item }) => {
          const selected = filter === item;
          return (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(item);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather
              name="search"
              size={28}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No exercises match "{query}"
            </Text>
            <Pressable
              onPress={() => router.push("/custom-exercise")}
              style={({ pressed }) => [
                styles.createBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="plus"
                size={16}
                color={colors.primaryForeground}
              />
              <Text
                style={[
                  styles.createLabel,
                  { color: colors.primaryForeground },
                ]}
              >
                Create custom exercise
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleAdd(item)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <ExerciseImage size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {item.name}
              </Text>
              <Text
                style={[styles.cat, { color: colors.mutedForeground }]}
              >
                {item.category}
                {item.isCustom ? " \u00B7 custom" : ""}
              </Text>
            </View>
            <View
              style={[
                styles.plus,
                { backgroundColor: colors.accent, borderRadius: 999 },
              ]}
            >
              <Feather name="plus" size={16} color={colors.primary} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    padding: 0,
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  cat: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  plus: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginBottom: 12,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
