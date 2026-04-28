import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { CATEGORIES } from "@/lib/types";
import type { Category } from "@/lib/types";

export default function CustomExerciseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { active, addCustomExercise, addExerciseToActive } = useWorkout();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(
    active?.category ?? "Chest",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const ex = addCustomExercise(trimmed, category);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (active) {
      addExerciseToActive(ex.id);
    }
    router.back();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: insets.bottom + 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        EXERCISE NAME
      </Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.input, borderRadius: 12 },
        ]}
      >
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError(null);
          }}
          placeholder="e.g. Cable Crossover"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      <Text
        style={[
          styles.label,
          { color: colors.mutedForeground, marginTop: 24 },
        ]}
      >
        CATEGORY
      </Text>
      <View style={styles.chipsWrap}>
        {CATEGORIES.map((c) => {
          const selected = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => {
                Haptics.selectionAsync();
                setCategory(c);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton
        label={active ? "Save and Add to Workout" : "Save Exercise"}
        onPress={handleSave}
        disabled={name.trim().length < 2}
        style={{ marginTop: 32 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputWrap: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    padding: 0,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 8,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
