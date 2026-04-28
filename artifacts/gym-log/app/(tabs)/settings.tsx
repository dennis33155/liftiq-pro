import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    workouts,
    customExercises,
    deleteCustomExercise,
    clearAllData,
  } = useWorkout();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? 84 + 16 : 100;

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Clear all data?",
      "This deletes all workouts and custom exercises. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          },
        },
      ],
    );
  };

  const handleDeleteCustom = (id: string, name: string) => {
    Alert.alert("Delete exercise", `Remove "${name}" from custom exercises?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteCustomExercise(id);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 8,
        paddingBottom: bottomPad,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.h1, { color: colors.foreground }]}>Settings</Text>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>
        STATS
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Row label="Workouts logged" value={workouts.length.toString()} />
        <Divider />
        <Row
          label="Custom exercises"
          value={customExercises.length.toString()}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.mutedForeground }]}>
          CUSTOM EXERCISES
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/custom-exercise");
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[styles.addLabel, { color: colors.primary }]}>
            Add
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        {customExercises.length === 0 ? (
          <View style={styles.empty}>
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              No custom exercises. Tap Add to create your own.
            </Text>
          </View>
        ) : (
          customExercises.map((ex, idx) => (
            <View key={ex.id}>
              {idx > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.rowLabel, { color: colors.foreground }]}
                  >
                    {ex.name}
                  </Text>
                  <Text
                    style={[
                      styles.rowSub,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {ex.category}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDeleteCustom(ex.id, ex.name)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Feather
                    name="trash-2"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>
        DATA
      </Text>
      <Pressable
        onPress={handleClear}
        style={({ pressed }) => [
          styles.dangerBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.destructive,
            borderRadius: colors.radius,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="trash-2" size={18} color={colors.destructive} />
        <Text style={[styles.dangerLabel, { color: colors.destructive }]}>
          Clear All Data
        </Text>
      </Pressable>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Gym Log {"\u00B7"} All data lives on this device
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View
      style={[styles.divider, { backgroundColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  h1: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  section: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 24,
    marginBottom: 8,
  },
  addLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  rowValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  rowSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  dangerBtn: {
    marginTop: 8,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  footer: {
    marginTop: 28,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
  },
});
