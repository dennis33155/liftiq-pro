import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { WorkoutSet } from "@/lib/types";

type Props = {
  index: number;
  set: WorkoutSet;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
};

export function SetRow({ index, set, onChange, onDelete }: Props) {
  const colors = useColors();

  const toggleDone = () => {
    Haptics.impactAsync(
      set.done
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    );
    onChange({ done: !set.done });
  };

  const handleWeight = (text: string) => {
    const cleaned = text.replace(",", ".").replace(/[^0-9.]/g, "");
    const num = cleaned === "" ? null : Number(cleaned);
    onChange({ weight: num === null || Number.isNaN(num) ? null : num });
  };

  const handleReps = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    const num = cleaned === "" ? null : Number(cleaned);
    onChange({ reps: num === null || Number.isNaN(num) ? null : num });
  };

  const rowBg = set.done ? colors.accent : "transparent";

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: rowBg,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text
        style={[
          styles.idx,
          { color: set.done ? colors.primary : colors.mutedForeground },
        ]}
      >
        {index + 1}
      </Text>

      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.input, borderRadius: 10 },
        ]}
      >
        <TextInput
          value={set.weight === null ? "" : String(set.weight)}
          onChangeText={handleWeight}
          placeholder="lb"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>

      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.input, borderRadius: 10 },
        ]}
      >
        <TextInput
          value={set.reps === null ? "" : String(set.reps)}
          onChangeText={handleReps}
          placeholder="reps"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>

      <Pressable
        onPress={toggleDone}
        style={({ pressed }) => [
          styles.doneBtn,
          {
            backgroundColor: set.done ? colors.primary : "transparent",
            borderColor: set.done ? colors.primary : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name="check"
          size={18}
          color={set.done ? colors.primaryForeground : colors.mutedForeground}
        />
      </Pressable>

      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.delBtn, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Feather name="x" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 8,
  },
  idx: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    width: 22,
    textAlign: "center",
  },
  inputWrap: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  input: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    padding: 0,
    minHeight: 20,
  },
  doneBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  delBtn: {
    width: 28,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
