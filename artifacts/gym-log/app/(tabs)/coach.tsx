import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { LiveDateTime } from "@/components/LiveDateTime";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import {
  requestCoachRecommendations,
  type CoachRecommendations,
  type CoachResponse,
} from "@/lib/api";
import { useSubscription } from "@/lib/subscription";
import {
  computePersonalRecords,
  topPersonalRecords,
  type PersonalRecord,
} from "@/lib/personalRecords";
import { loadBodyMetrics } from "@/lib/bodyMetrics";
import { loadProgressPhotos } from "@/lib/progressPhotos";

const STORAGE_KEY = "gym-log:coach-recs:v1";

type StoredCoach = {
  createdAt: number;
  recommendations: CoachRecommendations;
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.floor(h / 24);
  return d + " d ago";
}

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workouts, allExercises } = useWorkout();
  const { isPro, showUpgradePrompt } = useSubscription();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stored, setStored] = useState<StoredCoach | null>(null);
  const [showAllPRs, setShowAllPRs] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw || !mountedRef.current) return;
        try {
          const parsed = JSON.parse(raw) as StoredCoach;
          setStored(parsed);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const allRecords = useMemo(
    () => computePersonalRecords(workouts, allExercises),
    [workouts, allExercises],
  );

  const visibleRecords = useMemo(
    () => (showAllPRs ? allRecords : topPersonalRecords(allRecords, 5)),
    [allRecords, showAllPRs],
  );

  const handleGenerate = useCallback(async () => {
    if (submitting) return;
    if (allRecords.length === 0) {
      Alert.alert(
        "Not enough data",
        "Log at least one completed set in any workout first.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const completed = workouts
        .filter((w) => w.endedAt !== null)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
        .slice(0, 10);

      const exerciseById = new Map(allExercises.map((e) => [e.id, e]));
      const recentWorkouts = completed.map((w) => ({
        date: new Date(w.endedAt ?? w.startedAt).toISOString().slice(0, 10),
        category: w.category,
        exerciseNames: w.exercises
          .map((we) => exerciseById.get(we.exerciseId)?.name ?? null)
          .filter((n): n is string => n !== null),
      }));

      const personalRecords = allRecords.slice(0, 30).map((p) => ({
        exerciseName: p.exerciseName,
        category: p.category,
        estimated1RM: p.estimated1RM,
        bestWeight: p.bestWeight,
        bestReps: p.bestReps,
        lastWeight: p.lastWeight,
        lastReps: p.lastReps,
        lastDate:
          p.lastDate != null
            ? new Date(p.lastDate).toISOString().slice(0, 10)
            : null,
        totalSessions: p.totalSessions,
      }));

      const availableExercises = allExercises.map((e) => ({
        name: e.name,
        category: e.category,
        primaryMuscles: e.primaryMuscles,
      }));

      const [bodyMetricsAll, photos] = await Promise.all([
        loadBodyMetrics().catch(() => []),
        loadProgressPhotos().catch(() => []),
      ]);
      const bodyMetrics = bodyMetricsAll.slice(0, 8).map((m) => ({
        date: new Date(m.date).toISOString().slice(0, 10),
        weightLb: m.weightLb,
        bodyFatPct: m.bodyFatPct,
      }));

      const result: CoachResponse = await requestCoachRecommendations({
        notes: notes.trim() || undefined,
        isPro,
        personalRecords,
        recentWorkouts,
        availableExercises,
        bodyMetrics: bodyMetrics.length > 0 ? bodyMetrics : undefined,
        progressPhotosCount: photos.length,
      });

      const next: StoredCoach = {
        createdAt: result.createdAt,
        recommendations: result.recommendations,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (mountedRef.current) {
        setStored(next);
        setNotes("");
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        Alert.alert("Coach unavailable", msg);
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [submitting, allRecords, workouts, allExercises, notes, isPro]);

  // Gate after all hooks have run (rules-of-hooks: hook count must be stable
  // across renders, including when the user upgrades from Free to Pro).
  if (!isPro) {
    return <CoachLockedScreen onUpgrade={showUpgradePrompt} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 16,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            AI COACH
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Personal Bests {"\u00B7"} Recommendations
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Live PRs from your training log plus AI-driven advice from Claude on
            what to push next.
          </Text>
        </View>
        <LiveDateTime variant="stack" align="right" />
      </View>

      <View style={styles.toolsRow}>
        <Pressable
          onPress={() => router.push("/body-metrics")}
          style={({ pressed }) => [
            styles.toolBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="activity" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.toolTitle, { color: colors.foreground }]}>
              Body Metrics
            </Text>
            <Text
              style={[styles.toolSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              Weight {"\u00B7"} body fat trend
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
        <Pressable
          onPress={() => router.push("/progress-photos")}
          style={({ pressed }) => [
            styles.toolBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="image" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.toolTitle, { color: colors.foreground }]}>
              Progress Photos
            </Text>
            <Text
              style={[styles.toolSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              Visual log by date
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
            PERSONAL RECORDS {"\u00B7"} EST 1RM
          </Text>
          {allRecords.length > 5 ? (
            <Pressable
              onPress={() => setShowAllPRs((v) => !v)}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>
                {showAllPRs
                  ? "Show top 5"
                  : "Show all (" + allRecords.length + ")"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {visibleRecords.length === 0 ? (
          <EmptyState
            icon="bar-chart-2"
            title="No PRs yet"
            description="Finish a workout with completed sets to start tracking personal records."
          />
        ) : (
          <View style={{ gap: 8 }}>
            {visibleRecords.map((p, i) => (
              <PrRow
                key={p.exerciseId}
                rank={i + 1}
                record={p}
                onPress={() =>
                  router.push({
                    pathname: "/pr-history/[id]",
                    params: { id: p.exerciseId },
                  })
                }
              />
            ))}
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              Tap any PR for trend chart and session log.
            </Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          AI RECOMMENDATIONS
        </Text>
        <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
          Optional: anything you want the coach to factor in (energy, soreness,
          goals).
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. shoulder feels tight, focus chest peak"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={300}
          style={[
            styles.notesInput,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.foreground,
            },
          ]}
        />
        <PrimaryButton
          label={
            submitting
              ? "Asking Claude..."
              : stored
                ? "Refresh Recommendations"
                : "Generate Recommendations"
          }
          onPress={handleGenerate}
          disabled={submitting}
          icon={
            submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Feather name="cpu" size={16} color={colors.primaryForeground} />
            )
          }
        />
        {stored ? (
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            Updated {timeAgo(stored.createdAt)}
          </Text>
        ) : null}
      </View>

      {stored ? <RecommendationsCard data={stored.recommendations} /> : null}

      {!stored && allRecords.length > 0 ? (
        <EmptyState
          icon="zap"
          title="Ready when you are"
          description="Tap Generate to get a personalized plan from the AI coach."
        />
      ) : null}
    </ScrollView>
  );
}

function PrRow({
  rank,
  record,
  onPress,
}: {
  rank: number;
  record: PersonalRecord;
  onPress?: () => void;
}) {
  const colors = useColors();
  const lastText =
    record.lastWeight != null && record.lastReps != null
      ? record.lastWeight + " x " + record.lastReps
      : "--";
  const lastDateText =
    record.lastDate != null ? formatDate(record.lastDate) : "--";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.prRow,
        {
          borderColor: colors.border,
          opacity: pressed && onPress ? 0.7 : 1,
          backgroundColor: pressed && onPress ? colors.muted : "transparent",
        },
      ]}
    >
      <View
        style={[
          styles.prRank,
          { backgroundColor: colors.primary },
        ]}
      >
        <Text style={[styles.prRankText, { color: colors.primaryForeground }]}>
          {rank}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[styles.prName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {record.exerciseName}
        </Text>
        <Text style={[styles.prMeta, { color: colors.mutedForeground }]}>
          {record.category}
          {"  \u00B7  "}
          best {record.bestWeight} x {record.bestReps}
          {"  \u00B7  "}
          last {lastText} {"\u00B7"} {lastDateText}
        </Text>
      </View>
      <View style={styles.prValue}>
        <Text style={[styles.prValueNum, { color: colors.primary }]}>
          {record.estimated1RM.toFixed(1)}
        </Text>
        <Text style={[styles.prValueLabel, { color: colors.mutedForeground }]}>
          1RM
        </Text>
      </View>
      {onPress ? (
        <Feather
          name="chevron-right"
          size={16}
          color={colors.mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}

function RecommendationsCard({ data }: { data: CoachRecommendations }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.resultHeadline, { color: colors.foreground }]}>
        {data.headline}
      </Text>

      <Section title="FOCUS NEXT">
        {data.focusExercises.map((f, i) => (
          <View key={"f-" + i} style={styles.focusRow}>
            <View style={[styles.focusChip, { backgroundColor: colors.primary }]}>
              <Text
                style={[
                  styles.focusChipText,
                  { color: colors.primaryForeground },
                ]}
                numberOfLines={1}
              >
                {f.exerciseName}
              </Text>
            </View>
            <Text style={[styles.focusReason, { color: colors.foreground }]}>
              {f.reason}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="PROGRESSION PLAN">
        {data.progressionPlan.map((p, i) => (
          <View
            key={"p-" + i}
            style={[styles.planRow, { borderColor: colors.border }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.planName, { color: colors.foreground }]}>
                {p.exerciseName}
              </Text>
              <Text style={[styles.planNote, { color: colors.mutedForeground }]}>
                {p.note}
              </Text>
            </View>
            <View style={styles.planRx}>
              <Text style={[styles.planRxNum, { color: colors.primary }]}>
                {p.suggestedSets} x {p.suggestedReps}
              </Text>
              <Text
                style={[styles.planRxLabel, { color: colors.mutedForeground }]}
              >
                @ {p.suggestedWeight}
              </Text>
            </View>
          </View>
        ))}
      </Section>

      {data.neglectedAreas.length > 0 ? (
        <Section title="NEGLECTED">
          {data.neglectedAreas.map((n, i) => (
            <View key={"n-" + i} style={styles.neglectedRow}>
              <View
                style={[
                  styles.neglectedChip,
                  { borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.neglectedChipText, { color: colors.primary }]}>
                  {n.area}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[styles.neglectedExercise, { color: colors.foreground }]}
                >
                  {n.recommendedExercise}
                </Text>
                <Text
                  style={[styles.neglectedReason, { color: colors.mutedForeground }]}
                >
                  {n.reason}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="TIP OF THE WEEK">
        <Text style={[styles.tipText, { color: colors.foreground }]}>
          {data.weeklyTip}
        </Text>
      </Section>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function CoachLockedScreen({ onUpgrade }: { onUpgrade: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            AI COACH
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Personal Bests {"\u00B7"} Recommendations
          </Text>
        </View>
        <LiveDateTime variant="stack" align="right" />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary + "1F",
          }}
        >
          <Feather name="lock" size={38} color={colors.primary} />
        </View>
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 22,
            letterSpacing: -0.3,
            color: colors.foreground,
            textAlign: "center",
          }}
        >
          AI Coach is a Pro feature
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            lineHeight: 20,
            color: colors.mutedForeground,
            textAlign: "center",
            paddingHorizontal: 24,
          }}
        >
          Pull live PRs from your training log and get AI-driven advice from
          Claude on what to push next. Available with Pro.
        </Text>
        <PrimaryButton
          label="Upgrade to Pro"
          onPress={onUpgrade}
          icon={<Feather name="zap" size={16} color={colors.primaryForeground} />}
          style={{ minWidth: 220 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  toolsRow: {
    gap: 10,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toolTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  toolSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  linkText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  notesInput: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlignVertical: "top",
  },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  prRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  prRankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  prName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  prMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  prValue: {
    alignItems: "flex-end",
    minWidth: 56,
  },
  prValueNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  prValueLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  resultCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  resultHeadline: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    lineHeight: 22,
  },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  focusRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  focusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 140,
  },
  focusChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  focusReason: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  planRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  planName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  planNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  planRx: {
    alignItems: "flex-end",
    minWidth: 78,
  },
  planRxNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  planRxLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  neglectedRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  neglectedChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  neglectedChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  neglectedExercise: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  neglectedReason: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
