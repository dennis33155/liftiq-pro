import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryCard } from "@/components/CategoryCard";
import { LiveDateTime } from "@/components/LiveDateTime";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { useSubscription } from "@/lib/subscription";
import {
  CUSTOM_SCHEDULE_OPTIONS,
  getEffectiveTodaySlot,
  getEffectiveWeek,
  useCustomSchedule,
  type CustomScheduleValue,
} from "@/lib/customSchedule";
import { formatRelative } from "@/lib/format";
import { workoutVolume } from "@/lib/progression";
import type { DaySlot } from "@/lib/schedule";
import { computeStreak } from "@/lib/streak";
import { CATEGORIES } from "@/lib/types";
import type { Category } from "@/lib/types";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { active, startWorkout, startSuggestedWorkout, startAiWorkout, workouts } =
    useWorkout();
  const { isPro, requireProOrPrompt } = useSubscription();

  const [aiCategory, setAiCategory] = React.useState<Category | null>(null);
  const [aiNotes, setAiNotes] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const aiInFlight = React.useRef(false);

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

  const handleSuggest = (category: Category) => {
    if (active) {
      router.push("/workout");
      return;
    }
    startSuggestedWorkout(category, 5);
    router.push("/workout");
  };

  const handleAiOpen = (category: Category) => {
    if (active) {
      router.push("/workout");
      return;
    }
    if (!requireProOrPrompt()) return;
    setAiNotes("");
    setAiCategory(category);
  };

  const handleAiClose = () => {
    if (aiLoading) return;
    setAiCategory(null);
  };

  const handleAiGenerate = async () => {
    if (!aiCategory) return;
    if (aiInFlight.current) return;
    aiInFlight.current = true;
    setAiLoading(true);
    const requestedCategory = aiCategory;
    try {
      const trimmed = aiNotes.trim();
      const { rationale } = await startAiWorkout(requestedCategory, {
        count: 5,
        notes: trimmed.length > 0 ? trimmed : undefined,
        isPro,
      });
      setAiCategory(null);
      setAiNotes("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (rationale) {
        Alert.alert("AI Coach", rationale);
      }
      router.push("/workout");
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert(
        "AI request failed",
        msg + "\n\nCheck your connection and try again.",
      );
    } finally {
      aiInFlight.current = false;
      setAiLoading(false);
    }
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

  const streak = React.useMemo(() => computeStreak(workouts), [workouts]);

  const lastWorkout = workouts[0];
  const { overrides, setDay: setScheduleDay } = useCustomSchedule();
  const week = React.useMemo(() => getEffectiveWeek(overrides), [overrides]);
  const today = React.useMemo(
    () => getEffectiveTodaySlot(overrides),
    [overrides],
  );
  const todayDay = today.day;
  const [editingDay, setEditingDay] = React.useState<DaySlot | null>(null);

  const handlePickDay = async (day: number, value: CustomScheduleValue) => {
    Haptics.selectionAsync();
    await setScheduleDay(day, value);
    setEditingDay(null);
  };

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting()}
          </Text>
          <Text style={[styles.appName, { color: colors.foreground }]}>
            AI Fitness Trainer Pro
          </Text>
          <LiveDateTime variant="row" align="left" style={{ marginTop: 6 }} />
        </View>
        <View
          style={[
            styles.streakBadge,
            { backgroundColor: colors.accent, borderColor: colors.border },
          ]}
        >
          <Feather name="zap" size={14} color={colors.primary} />
          <Text style={[styles.streakText, { color: colors.foreground }]}>
            {streak}
          </Text>
          <Text
            style={[styles.streakSuffix, { color: colors.mutedForeground }]}
          >
            {streak === 1 ? "day" : "days"}
          </Text>
        </View>
      </View>

      {active ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/workout");
          }}
          accessibilityLabel={`Resume in-progress ${active.category} workout`}
          style={({ pressed }) => [
            styles.resumePill,
            {
              backgroundColor: colors.accent,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={[styles.resumeDot, { backgroundColor: colors.primary }]}
          />
          <Text
            style={[styles.resumePillText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            Resume {active.category}
            <Text style={{ color: colors.mutedForeground }}>
              {"  \u00B7  "}
              {active.exercises.length}{" "}
              {active.exercises.length === 1 ? "exercise" : "exercises"}
              {"  \u00B7  "}
              started {formatRelative(active.startedAt).toLowerCase()}
            </Text>
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}
      <TodayCard
        slot={today}
        onStart={() => {
          if (today.category) handleStart(today.category);
        }}
        onSuggest={() => {
          if (today.category) handleSuggest(today.category);
        }}
        onAi={() => {
          if (today.category) handleAiOpen(today.category);
        }}
      />
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
        <StatTile
          label="Total"
          value={workouts.length.toString()}
          sub="workouts"
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        WEEKLY SPLIT
      </Text>
      <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
        Tap a day to set its workout. Reset from Settings.
      </Text>
      <View style={styles.weekStrip}>
        {week.map((slot) => {
          const isToday = slot.day === todayDay;
          return (
            <Pressable
              key={slot.day}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingDay(slot);
              }}
              accessibilityLabel={`Edit ${slot.long} workout`}
              style={({ pressed }) => [
                styles.weekPill,
                {
                  backgroundColor: isToday ? colors.primary : colors.card,
                  borderColor: isToday ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.weekPillDay,
                  {
                    color: isToday
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {slot.short.toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.weekPillCat,
                  {
                    color: isToday
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
                numberOfLines={1}
              >
                {slot.isRest ? "Rest" : slot.category}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        ALL CATEGORIES
      </Text>
      <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
        Override the schedule. Tap to start blank, or "Suggest" to auto-build.
      </Text>

      <View style={styles.categories}>
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat}
            category={cat}
            onPress={() => handleStart(cat)}
            onSuggest={active ? undefined : () => handleSuggest(cat)}
            onAi={active ? undefined : () => handleAiOpen(cat)}
          />
        ))}
      </View>
    </ScrollView>
    <Modal
      visible={aiCategory !== null}
      transparent
      animationType="fade"
      onRequestClose={handleAiClose}
    >
      <Pressable
        onPress={handleAiClose}
        style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.6)" }]}
      >
        <Pressable
          onPress={() => {}}
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Feather name="cpu" size={18} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              AI Workout {aiCategory ? "\u00B7 " + aiCategory : ""}
            </Text>
          </View>
          <Text
            style={[styles.modalHint, { color: colors.mutedForeground }]}
          >
            Optional notes for the coach (energy level, focus areas, soreness).
          </Text>
          <TextInput
            value={aiNotes}
            onChangeText={setAiNotes}
            editable={!aiLoading}
            placeholder="e.g. low energy, focus on chest peak"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={handleAiClose}
              disabled={aiLoading}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.border,
                  opacity: pressed || aiLoading ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.modalBtnLabel,
                  { color: colors.foreground },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAiGenerate}
              disabled={aiLoading}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: "row",
                },
              ]}
            >
              {aiLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primaryForeground}
                />
              ) : (
                <Feather
                  name="zap"
                  size={14}
                  color={colors.primaryForeground}
                />
              )}
              <Text
                style={[
                  styles.modalBtnLabel,
                  { color: colors.primaryForeground, marginLeft: 6 },
                ]}
              >
                {aiLoading ? "Generating" : "Generate"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal
      visible={editingDay !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setEditingDay(null)}
    >
      <Pressable
        onPress={() => setEditingDay(null)}
        style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.6)" }]}
      >
        <Pressable
          onPress={() => {}}
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingDay ? editingDay.long : ""}
            </Text>
          </View>
          <Text
            style={[styles.modalHint, { color: colors.mutedForeground }]}
          >
            Choose what this day should be.
          </Text>
          <View style={styles.dayOptionList}>
            {CUSTOM_SCHEDULE_OPTIONS.map((option) => {
              const current =
                editingDay &&
                ((editingDay.isRest && option === "Rest") ||
                  (!editingDay.isRest && editingDay.category === option));
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    if (editingDay) handlePickDay(editingDay.day, option);
                  }}
                  style={({ pressed }) => [
                    styles.dayOption,
                    {
                      backgroundColor: current
                        ? colors.primary
                        : colors.background,
                      borderColor: current ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayOptionText,
                      {
                        color: current
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {option}
                  </Text>
                  {current ? (
                    <Feather
                      name="check"
                      size={16}
                      color={colors.primaryForeground}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => setEditingDay(null)}
            style={({ pressed }) => [
              styles.modalBtn,
              {
                backgroundColor: colors.accent,
                borderColor: colors.border,
                opacity: pressed ? 0.6 : 1,
                alignSelf: "stretch",
              },
            ]}
          >
            <Text
              style={[styles.modalBtnLabel, { color: colors.foreground }]}
            >
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

function TodayCard({
  slot,
  onStart,
  onSuggest,
  onAi,
}: {
  slot: DaySlot;
  onStart: () => void;
  onSuggest: () => void;
  onAi: () => void;
}) {
  const colors = useColors();

  if (slot.isRest) {
    return (
      <View
        style={[
          todayStyles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius + 4,
          },
        ]}
      >
        <View style={todayStyles.headerRow}>
          <Text style={[todayStyles.label, { color: colors.mutedForeground }]}>
            TODAY {"\u00B7"} {slot.long.toUpperCase()}
          </Text>
          <View
            style={[
              todayStyles.badge,
              { backgroundColor: colors.accent, borderColor: colors.border },
            ]}
          >
            <Text
              style={[todayStyles.badgeText, { color: colors.mutedForeground }]}
            >
              REST DAY
            </Text>
          </View>
        </View>
        <Text style={[todayStyles.title, { color: colors.foreground }]}>
          Rest
        </Text>
        <Text style={[todayStyles.note, { color: colors.mutedForeground }]}>
          {slot.note ?? "Recover. Eat. Sleep."}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        todayStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <View style={todayStyles.headerRow}>
        <Text style={[todayStyles.label, { color: colors.mutedForeground }]}>
          TODAY {"\u00B7"} {slot.long.toUpperCase()}
        </Text>
        {slot.badge ? (
          <View
            style={[
              todayStyles.badge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text
              style={[
                todayStyles.badgeText,
                { color: colors.primaryForeground },
              ]}
            >
              {slot.badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[todayStyles.title, { color: colors.foreground }]}>
        {slot.category}
      </Text>
      {slot.note ? (
        <Text style={[todayStyles.note, { color: colors.mutedForeground }]}>
          {slot.note}
        </Text>
      ) : null}
      <View style={todayStyles.actions}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAi();
          }}
          style={({ pressed }) => [
            todayStyles.btn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="cpu" size={14} color={colors.primaryForeground} />
          <Text
            style={[todayStyles.btnText, { color: colors.primaryForeground }]}
          >
            AI
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSuggest();
          }}
          style={({ pressed }) => [
            todayStyles.btn,
            {
              backgroundColor: colors.accent,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="zap" size={14} color={colors.foreground} />
          <Text style={[todayStyles.btnText, { color: colors.foreground }]}>
            Suggest
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStart();
          }}
          style={({ pressed }) => [
            todayStyles.btn,
            todayStyles.btnPrimary,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text
            style={[todayStyles.btnText, { color: colors.primaryForeground }]}
          >
            Start
          </Text>
          <Feather
            name="arrow-right"
            size={14}
            color={colors.primaryForeground}
          />
        </Pressable>
      </View>
    </View>
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
  streakSuffix: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.4,
    marginLeft: 2,
  },
  resumePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  resumeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resumePillText: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
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
    marginBottom: 6,
  },
  sectionHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  categories: {
    paddingHorizontal: 20,
    gap: 10,
  },
  weekStrip: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 28,
  },
  weekPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekPillDay: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  weekPillCat: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 0.2,
  },
  dayOptionList: {
    gap: 8,
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayOptionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  modalHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

const todayStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    marginBottom: 6,
  },
  note: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
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
