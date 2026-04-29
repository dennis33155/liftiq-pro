import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { useAiUsage, AI_LIMIT_MESSAGE } from "@/lib/aiUsage";
import {
  ProRequiredError,
  requestPhotoAnalysis,
  WeeklyAiLimitError,
} from "@/lib/api";
import { useSubscription } from "@/lib/subscription";
import {
  addProgressPhoto,
  deleteProgressPhoto,
  getPhotoDataUri,
  loadProgressPhotos,
  setProgressPhotoAnalysis,
  type ProgressPhoto,
} from "@/lib/progressPhotos";
import type { Workout } from "@/lib/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function buildCoachComment(workouts: Workout[], photoCount: number): string {
  if (photoCount === 0) {
    return "Snap your first photo. The mirror lies, photos don't.";
  }
  const now = Date.now();
  const completed = workouts.filter(
    (w) => w.endedAt !== null && now - (w.endedAt ?? 0) <= 14 * ONE_DAY_MS,
  );
  if (completed.length === 0) {
    return "Stay consistent. The work is showing.";
  }

  const last7d = completed.filter(
    (w) => now - (w.endedAt ?? 0) <= 7 * ONE_DAY_MS,
  );
  const backCount7 = last7d.filter((w) => w.category === "Back").length;
  const has14 = (cat: string) =>
    completed.some((w) => w.category === cat);

  let chestSets14 = 0;
  for (const w of completed) {
    if (w.category !== "Chest") continue;
    for (const ex of w.exercises) {
      chestSets14 += ex.sets.filter((s) => s.done).length;
    }
  }

  if (backCount7 >= 3) {
    return "Back width is improving. Keep the volume.";
  }
  if (chestSets14 >= 30) {
    return "Chest pressing volume is high. Mirror it with rows.";
  }
  if (has14("Shoulders") && has14("Arms")) {
    return "Shoulders and arms are starting to stand out.";
  }
  if (has14("Legs")) {
    return "Lower body work is showing. Don't skip the next leg day.";
  }
  return "Stay consistent. The work is showing.";
}

function formatDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return y + "-" + m + "-" + dd;
}

function groupByDay(photos: ProgressPhoto[]): {
  key: string;
  date: number;
  photos: ProgressPhoto[];
}[] {
  const map = new Map<string, { date: number; photos: ProgressPhoto[] }>();
  for (const p of photos) {
    const k = dayKey(p.date);
    let bucket = map.get(k);
    if (!bucket) {
      bucket = { date: p.date, photos: [] };
      map.set(k, bucket);
    }
    bucket.photos.push(p);
    if (p.date > bucket.date) bucket.date = p.date;
  }
  return Array.from(map.entries())
    .map(([key, b]) => ({ key, date: b.date, photos: b.photos }))
    .sort((a, b) => b.date - a.date);
}

const COLUMNS = 3;
const GAP = 6;
const HORIZONTAL_PADDING = 16;

export default function ProgressPhotosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workouts } = useWorkout();
  const { isPro, ready: subReady, showUpgradePrompt } = useSubscription();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [viewerAnalyzing, setViewerAnalyzing] = useState(false);

  useEffect(() => {
    let alive = true;
    loadProgressPhotos()
      .then((res) => {
        if (alive) {
          setPhotos(res);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handlePick = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to add progress shots.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: false,
        exif: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const next = await addProgressPhoto(asset.uri, Date.now());
      setPhotos(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Could not add photo", msg);
    } finally {
      setAdding(false);
    }
  }, [adding]);

  const handleTakePhoto = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow camera access to capture progress shots.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: false,
        exif: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const next = await addProgressPhoto(asset.uri, Date.now());
      setPhotos(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Could not capture photo", msg);
    } finally {
      setAdding(false);
    }
  }, [adding]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete photo?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteProgressPhoto(id)
              .then((next) => {
                setPhotos(next);
                if (viewing && viewing.id === id) setViewing(null);
                setSelectedIds((prev) => {
                  if (!prev.has(id)) return prev;
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              })
              .catch(() => {});
          },
        },
      ]);
    },
    [viewing],
  );

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        return false;
      }
      return true;
    });
  }, []);

  const togglePhotoSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ai = useAiUsage();

  const showLimitReached = useCallback(() => {
    // Pro-only path now. Free users never reach this — they're blocked
    // upstream by the upgrade gate before any network call.
    Alert.alert("Weekly AI limit", AI_LIMIT_MESSAGE, [{ text: "OK" }]);
  }, []);

  const runAnalysisFor = useCallback(
    async (photo: ProgressPhoto): Promise<ProgressPhoto[] | null> => {
      // Client-side gates: Pro required, then weekly cap.
      if (!isPro) {
        showUpgradePrompt();
        return null;
      }
      if (!ai.canUseNow()) {
        showLimitReached();
        return null;
      }
      try {
        const dataUri = await getPhotoDataUri(photo);
        const result = await requestPhotoAnalysis({
          imageDataUri: dataUri,
          photoDate: photo.date,
          isPro,
        });
        // Only count successful calls — failed analyses do not consume budget.
        await ai.incrementUsage();
        const next = await setProgressPhotoAnalysis(photo.id, {
          text: result.analysis,
          analyzedAt: result.analyzedAt,
          model: result.model,
        });
        return next;
      } catch (err) {
        if (err instanceof ProRequiredError) {
          showUpgradePrompt();
          return null;
        }
        if (err instanceof WeeklyAiLimitError) {
          showLimitReached();
          return null;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        Alert.alert("Could not analyze photo", msg);
        return null;
      }
    },
    [ai, isPro, showLimitReached, showUpgradePrompt],
  );

  const handleAnalyzeSelected = useCallback(async () => {
    if (analyzing) return;
    if (selectedIds.size === 0) return;
    const targets = photos.filter((p) => selectedIds.has(p.id));
    if (targets.length === 0) return;

    setAnalyzing(true);
    setAnalyzeProgress({ done: 0, total: targets.length });
    let anySucceeded = false;
    for (let i = 0; i < targets.length; i += 1) {
      const photo = targets[i];
      const updated = await runAnalysisFor(photo);
      if (updated) {
        anySucceeded = true;
        // Functional update so we never overwrite with a stale snapshot.
        setPhotos(() => updated);
      }
      setAnalyzeProgress({ done: i + 1, total: targets.length });
    }
    setAnalyzing(false);
    setAnalyzeProgress(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    if (anySucceeded) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
  }, [analyzing, photos, runAnalysisFor, selectedIds]);

  const handleAnalyzeViewing = useCallback(async () => {
    if (!viewing || viewerAnalyzing) return;
    setViewerAnalyzing(true);
    try {
      const updated = await runAnalysisFor(viewing);
      if (updated) {
        setPhotos(updated);
        const refreshed = updated.find((p) => p.id === viewing.id) ?? null;
        setViewing(refreshed);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    } finally {
      setViewerAnalyzing(false);
    }
  }, [runAnalysisFor, viewing, viewerAnalyzing]);

  const groups = useMemo(() => groupByDay(photos), [photos]);
  const coachComment = useMemo(
    () => buildCoachComment(workouts, photos.length),
    [workouts, photos.length],
  );

  const screenWidth = Dimensions.get("window").width;
  const cellSize =
    (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const selectedCount = selectedIds.size;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: HORIZONTAL_PADDING,
          gap: 16,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            PROGRESS PHOTOS
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Visual Progress
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Photos are stored on this device only. Tap to enlarge, hold to
            delete.
          </Text>
        </View>

        <View style={styles.btnRow}>
          <PrimaryButton
            label={adding ? "Working..." : "Take Photo"}
            onPress={handleTakePhoto}
            disabled={adding || selectMode}
            icon={
              adding ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Feather
                  name="camera"
                  size={16}
                  color={colors.primaryForeground}
                />
              )
            }
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="From Library"
            onPress={handlePick}
            disabled={adding || selectMode}
            variant="secondary"
            icon={
              <Feather name="image" size={16} color={colors.foreground} />
            }
            style={{ flex: 1 }}
          />
        </View>

        {photos.length > 0 && subReady && isPro ? (
          <View style={styles.btnRow}>
            <PrimaryButton
              label={selectMode ? "Cancel" : "Select Photos to Analyze"}
              onPress={toggleSelectMode}
              variant="secondary"
              disabled={analyzing}
              icon={
                <Feather
                  name={selectMode ? "x" : "check-square"}
                  size={16}
                  color={colors.foreground}
                />
              }
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        {subReady && isPro && selectMode ? (
          <View
            style={[
              styles.selectBar,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.selectCount, { color: colors.foreground }]}>
              {selectedCount === 0
                ? "Tap photos to select"
                : selectedCount +
                  " photo" +
                  (selectedCount === 1 ? "" : "s") +
                  " selected"}
            </Text>
            <PrimaryButton
              label={
                analyzing
                  ? "Analyzing " +
                    (analyzeProgress
                      ? analyzeProgress.done + "/" + analyzeProgress.total
                      : "...")
                  : "Analyze Photos"
              }
              onPress={handleAnalyzeSelected}
              disabled={analyzing || selectedCount === 0}
              icon={
                analyzing ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Feather
                    name="zap"
                    size={16}
                    color={colors.primaryForeground}
                  />
                )
              }
            />
          </View>
        ) : null}

        {!subReady ? null : isPro ? (
          <>
            <View
              style={[
                styles.disclaimer,
                { borderColor: colors.border, backgroundColor: colors.muted },
              ]}
            >
              <Feather
                name="info"
                size={12}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.disclaimerText,
                  { color: colors.mutedForeground },
                ]}
              >
                Photos are analyzed only when you tap Analyze Photos.
              </Text>
            </View>

            <View
              style={[
                styles.usageBadge,
                {
                  borderColor:
                    ai.remaining === 0 ? colors.destructive : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Feather
                name={ai.remaining === 0 ? "alert-circle" : "zap"}
                size={14}
                color={
                  ai.remaining === 0 ? colors.destructive : colors.primary
                }
              />
              <Text
                style={[styles.usageBadgeText, { color: colors.foreground }]}
              >
                AI Pro
                {"  \u00B7  "}
                {ai.used}/{ai.limit} this week
              </Text>
            </View>
          </>
        ) : (
          <Pressable
            onPress={showUpgradePrompt}
            style={({ pressed }) => [
              styles.lockedCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.lockedIconWrap,
                { backgroundColor: colors.primary + "22" },
              ]}
            >
              <Feather name="lock" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.lockedTitle, { color: colors.foreground }]}
              >
                Unlock AI Photo Analysis
              </Text>
              <Text
                style={[styles.lockedSub, { color: colors.mutedForeground }]}
              >
                Pro members get AI-powered critiques on every progress shot.
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        )}

        {loaded ? (
          <View
            style={[
              styles.coachCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.coachHeader}>
              <Feather name="message-circle" size={14} color={colors.primary} />
              <Text style={[styles.coachLabel, { color: colors.primary }]}>
                COACH COMMENT
              </Text>
            </View>
            <Text style={[styles.coachBody, { color: colors.foreground }]}>
              {coachComment}
            </Text>
          </View>
        ) : null}

        {!loaded ? (
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Loading...
          </Text>
        ) : photos.length === 0 ? (
          <EmptyState
            icon="image"
            title="No photos yet"
            description="Snap a progress shot to start your visual log."
          />
        ) : (
          groups.map((group) => (
            <View
              key={group.key}
              style={[
                styles.dayCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.dayLabel, { color: colors.mutedForeground }]}
              >
                {formatDateLong(group.date).toUpperCase()}
                {"  \u00B7  "}
                {group.photos.length}{" "}
                {group.photos.length === 1 ? "photo" : "photos"}
              </Text>
              <View style={styles.grid}>
                {group.photos.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  const hasAnalysis = p.analysis != null;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        if (selectMode) togglePhotoSelected(p.id);
                        else setViewing(p);
                      }}
                      onLongPress={() => {
                        if (!selectMode) handleDelete(p.id);
                      }}
                      delayLongPress={400}
                      style={({ pressed }) => [
                        {
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 10,
                          overflow: "hidden",
                          opacity: pressed ? 0.7 : 1,
                          backgroundColor: colors.muted,
                          borderWidth: isSelected ? 3 : 0,
                          borderColor: isSelected
                            ? colors.primary
                            : "transparent",
                        },
                      ]}
                    >
                      <ExpoImage
                        source={{ uri: p.uri }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                      {hasAnalysis ? (
                        <View style={styles.aiBadge}>
                          <Feather name="zap" size={10} color="#ffffff" />
                          <Text style={styles.aiBadgeText}>AI</Text>
                        </View>
                      ) : null}
                      {isSelected ? (
                        <View
                          style={[
                            styles.selectedCheck,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Feather
                            name="check"
                            size={14}
                            color={colors.primaryForeground}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setViewing(null)}
            accessibilityLabel="Close photo viewer"
          />
          {viewing ? (
            <>
              <ExpoImage
                source={{ uri: viewing.uri }}
                style={styles.viewerImage}
                contentFit="contain"
              />
              <View
                pointerEvents="box-none"
                style={[
                  styles.viewerTopBar,
                  { paddingTop: insets.top + 8 },
                ]}
              >
                <Pressable
                  onPress={() => setViewing(null)}
                  hitSlop={10}
                  accessibilityLabel="Back to progress photos"
                  style={({ pressed }) => [
                    styles.viewerNavPill,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Feather name="chevron-left" size={18} color="#fafafa" />
                  <Text style={styles.viewerNavText}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setViewing(null);
                    try {
                      router.dismissAll();
                    } catch {
                      // ignore: nothing to dismiss
                    }
                    router.replace("/");
                  }}
                  hitSlop={10}
                  accessibilityLabel="Go to home"
                  style={({ pressed }) => [
                    styles.viewerNavPill,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Feather name="home" size={16} color="#fafafa" />
                  <Text style={styles.viewerNavText}>Home</Text>
                </Pressable>
              </View>
              <ScrollView
                style={[
                  styles.viewerSheet,
                  { paddingBottom: insets.bottom + 16 },
                ]}
                contentContainerStyle={styles.viewerSheetContent}
              >
                <View style={styles.viewerTopRow}>
                  <Text style={styles.viewerDate}>
                    {formatDateLong(viewing.date)}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(viewing.id)}
                    hitSlop={10}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                  >
                    <Feather name="trash-2" size={20} color="#fafafa" />
                  </Pressable>
                </View>

                {viewing.analysis ? (
                  <View style={styles.analysisCard}>
                    <View style={styles.analysisHeader}>
                      <Feather name="zap" size={12} color="#2979FF" />
                      <Text style={styles.analysisLabel}>
                        AI COACH ANALYSIS
                      </Text>
                    </View>
                    <Text style={styles.analysisBody}>
                      {viewing.analysis.text}
                    </Text>
                    <Text style={styles.analysisMeta}>
                      Analyzed{" "}
                      {new Date(viewing.analysis.analyzedAt).toLocaleString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </Text>
                  </View>
                ) : isPro ? (
                  <PrimaryButton
                    label={
                      viewerAnalyzing ? "Analyzing..." : "Analyze This Photo"
                    }
                    onPress={handleAnalyzeViewing}
                    disabled={viewerAnalyzing}
                    icon={
                      viewerAnalyzing ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Feather name="zap" size={16} color="#ffffff" />
                      )
                    }
                  />
                ) : (
                  <PrimaryButton
                    label="Upgrade to Analyze"
                    onPress={() => {
                      setViewing(null);
                      showUpgradePrompt();
                    }}
                    icon={
                      <Feather name="lock" size={16} color="#ffffff" />
                    }
                  />
                )}
              </ScrollView>
            </>
          ) : null}
        </View>
      </Modal>
    </>
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
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  usageBadge: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  usageBadgeText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  usageBadgeUpgrade: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  lockedCard: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  lockedSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disclaimerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  selectBar: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  selectCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  coachCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coachLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  coachBody: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  dayCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  dayLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  aiBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(41, 121, 255, 0.92)",
  },
  aiBadgeText: {
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.6,
  },
  selectedCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  viewerImage: {
    width: "100%",
    height: "55%",
    marginTop: "8%",
  },
  viewerTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
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
  viewerSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "45%",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  viewerSheetContent: {
    gap: 12,
    paddingBottom: 24,
  },
  viewerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewerDate: {
    color: "#fafafa",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  analysisCard: {
    backgroundColor: "rgba(41, 121, 255, 0.12)",
    borderColor: "rgba(41, 121, 255, 0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  analysisLabel: {
    color: "#2979FF",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  analysisBody: {
    color: "#fafafa",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  analysisMeta: {
    color: "rgba(250,250,250,0.55)",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
});
