import { Feather } from "@expo/vector-icons";
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  requestBodyAnalysis,
  type BodyAnalysisAngle,
} from "@/lib/api";
import {
  deleteBodyAnalysis,
  loadBodyAnalyses,
  saveBodyAnalysis,
  type StoredBodyAnalysis,
} from "@/lib/bodyAnalysisStorage";

const ANGLES: { key: BodyAnalysisAngle; label: string }[] = [
  { key: "front", label: "FRONT" },
  { key: "side", label: "SIDE" },
  { key: "back", label: "BACK" },
];

const MAX_PHOTOS = 4;

function mimeFromAsset(
  asset: ImagePicker.ImagePickerAsset,
): "image/jpeg" | "image/png" | "image/webp" {
  const m = asset.mimeType?.toLowerCase() ?? "";
  if (m.includes("png")) return "image/png";
  if (m.includes("webp")) return "image/webp";
  return "image/jpeg";
}

function persistPhoto(
  srcUri: string,
  id: string,
  index: number,
  mime: "image/jpeg" | "image/png" | "image/webp",
): string {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  try {
    const dir = new Directory(Paths.document, "body-analyses");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const src = new File(srcUri);
    const dest = new File(dir, id + "_" + index + "." + ext);
    src.copy(dest);
    return dest.uri;
  } catch {
    return srcUri;
  }
}

export default function AnalyzeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [angle, setAngle] = useState<BodyAnalysisAngle>("front");
  const [pickedAssets, setPickedAssets] = useState<ImagePicker.ImagePickerAsset[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<StoredBodyAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    loadBodyAnalyses().then((all) => {
      setHistory(all);
      if (all.length > 0 && all[0]) setActiveId(all[0].id);
    });
  }, []);

  const active = useMemo(
    () => history.find((h) => h.id === activeId) ?? null,
    [history, activeId],
  );

  const addAssets = useCallback(
    (incoming: ImagePicker.ImagePickerAsset[]) => {
      setPickedAssets((prev) => {
        const combined = [...prev, ...incoming];
        if (combined.length > MAX_PHOTOS) {
          Alert.alert(
            "Photo limit",
            "Up to " + MAX_PHOTOS + " photos per analysis. Extras were ignored.",
          );
          return combined.slice(0, MAX_PHOTOS);
        }
        return combined;
      });
    },
    [],
  );

  const handlePick = useCallback(
    async (source: "library" | "camera") => {
      if (pickedAssets.length >= MAX_PHOTOS) {
        Alert.alert(
          "Photo limit",
          "You've reached " + MAX_PHOTOS + " photos. Remove one to add more.",
        );
        return;
      }
      const remaining = MAX_PHOTOS - pickedAssets.length;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Camera access needed",
            "Enable camera access in Settings to take a progress photo.",
          );
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.5,
          base64: true,
          allowsEditing: false,
        });
        if (!res.canceled && res.assets[0]) addAssets([res.assets[0]]);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Photo access needed",
            "Enable photo library access in Settings.",
          );
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.5,
          base64: true,
          allowsEditing: false,
          allowsMultipleSelection: true,
          selectionLimit: remaining,
        });
        if (!res.canceled && res.assets.length > 0) addAssets(res.assets);
      }
    },
    [pickedAssets.length, addAssets],
  );

  const handleRemovePicked = useCallback((idx: number) => {
    setPickedAssets((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (submitting) return;
    if (pickedAssets.length === 0) {
      Alert.alert("No photo", "Pick or take a progress photo first.");
      return;
    }
    const usable = pickedAssets.filter((a) => !!a.base64);
    if (usable.length === 0) {
      Alert.alert("No photo data", "Photos could not be read. Try again.");
      return;
    }
    setSubmitting(true);
    try {
      const images = usable.map((a) => ({
        imageBase64: a.base64 as string,
        mimeType: mimeFromAsset(a),
      }));

      const result = await requestBodyAnalysis({
        images,
        angle,
      });

      const id = "ba_" + Date.now();
      const persistedUris = usable.map((a, i) =>
        persistPhoto(a.uri, id, i, mimeFromAsset(a)),
      );

      const entry: StoredBodyAnalysis = {
        id,
        createdAt: result.createdAt,
        angle,
        photoUris: persistedUris,
        analysis: result.analysis,
      };
      const next = await saveBodyAnalysis(entry, (evictedUris) => {
        for (const uri of evictedUris) {
          if (!uri.startsWith("file://")) continue;
          try {
            const f = new File(uri);
            if (f.exists) f.delete();
          } catch {
            // ignore: file may have been removed already
          }
        }
      });
      setHistory(next);
      setActiveId(entry.id);
      setPickedAssets([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Analysis failed", msg);
    } finally {
      setSubmitting(false);
    }
  }, [pickedAssets, angle, submitting]);

  const handleDelete = useCallback(
    async (id: string) => {
      Alert.alert("Delete analysis", "Remove this analysis from history?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const target = history.find((h) => h.id === id);
              for (const uri of target?.photoUris ?? []) {
                if (!uri.startsWith("file://")) continue;
                try {
                  const f = new File(uri);
                  if (f.exists) f.delete();
                } catch {
                  // ignore: file may have been removed already
                }
              }
              const next = await deleteBodyAnalysis(id);
              setHistory(next);
              if (activeId === id) {
                setActiveId(next[0]?.id ?? null);
              }
            } catch (err) {
              Alert.alert(
                "Delete failed",
                err instanceof Error ? err.message : "Unknown error",
              );
            }
          },
        },
      ]);
    },
    [activeId, history],
  );


  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={[styles.kicker, { color: colors.primary }]}>
          BODY ANALYSIS
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Physique Coach
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Submit a progress photo and get AI feedback on muscle development,
          symmetry, and exercise priorities.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          STEP 1 \u00B7 ANGLE
        </Text>
        <View style={styles.angleRow}>
          {ANGLES.map((a) => {
            const selected = a.key === angle;
            return (
              <Pressable
                key={a.key}
                onPress={() => setAngle(a.key)}
                style={({ pressed }) => [
                  styles.angleChip,
                  {
                    backgroundColor: selected
                      ? colors.primary
                      : colors.background,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.angleChipText,
                    {
                      color: selected
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          STEP 2 \u00B7 PHOTOS
        </Text>
        {pickedAssets.length > 0 ? (
          <View style={{ gap: 10 }}>
            <View style={styles.thumbGrid}>
              {pickedAssets.map((a, i) => (
                <View
                  key={a.uri + ":" + i}
                  style={[
                    styles.thumbWrap,
                    { borderColor: colors.border },
                  ]}
                >
                  <Image
                    source={{ uri: a.uri }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => handleRemovePicked(i)}
                    hitSlop={8}
                    style={[
                      styles.thumbRemove,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <Feather name="x" size={12} color={colors.foreground} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              {pickedAssets.length} of {MAX_PHOTOS} \u00B7 add more or remove any
            </Text>
            <View style={styles.pickRow}>
              <Pressable
                onPress={() => handlePick("camera")}
                disabled={pickedAssets.length >= MAX_PHOTOS}
                style={({ pressed }) => [
                  styles.pickBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity:
                      pickedAssets.length >= MAX_PHOTOS ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="camera" size={18} color={colors.foreground} />
                <Text style={[styles.pickBtnText, { color: colors.foreground }]}>
                  Add via Camera
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handlePick("library")}
                disabled={pickedAssets.length >= MAX_PHOTOS}
                style={({ pressed }) => [
                  styles.pickBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity:
                      pickedAssets.length >= MAX_PHOTOS ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="image" size={18} color={colors.foreground} />
                <Text style={[styles.pickBtnText, { color: colors.foreground }]}>
                  Add from Library
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={styles.pickRow}>
              <Pressable
                onPress={() => handlePick("camera")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="camera" size={18} color={colors.foreground} />
                <Text style={[styles.pickBtnText, { color: colors.foreground }]}>
                  Camera
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handlePick("library")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="image" size={18} color={colors.foreground} />
                <Text style={[styles.pickBtnText, { color: colors.foreground }]}>
                  Library
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              Add up to {MAX_PHOTOS} angles per analysis
            </Text>
          </View>
        )}
      </View>

      <PrimaryButton
        label={
          submitting
            ? "Analyzing..."
            : pickedAssets.length > 1
              ? "Analyze " + pickedAssets.length + " Photos"
              : "Analyze Photo"
        }
        onPress={handleAnalyze}
        disabled={pickedAssets.length === 0 || submitting}
        icon={
          submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Feather name="zap" size={16} color={colors.primaryForeground} />
          )
        }
      />

      {active ? (
        <AnalysisCard analysis={active} onDelete={handleDelete} />
      ) : null}

      {history.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
            HISTORY
          </Text>
          {history.map((h) => {
            const isActive = h.id === activeId;
            const date = new Date(h.createdAt);
            const dateText =
              date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }) +
              "  \u00B7  " +
              h.angle.toUpperCase();
            return (
              <View
                key={h.id}
                style={[
                  styles.histRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setActiveId(h.id)}
                  style={({ pressed }) => [
                    styles.histRowSelect,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View>
                    <Image
                      source={{ uri: h.photoUris[0] }}
                      style={styles.histThumb}
                    />
                    {h.photoUris.length > 1 ? (
                      <View
                        style={[
                          styles.histCountBadge,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.histCountText,
                            { color: colors.primaryForeground },
                          ]}
                        >
                          {h.photoUris.length}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.histTitle,
                        { color: colors.foreground },
                      ]}
                      numberOfLines={1}
                    >
                      {dateText}
                    </Text>
                    <Text
                      style={[styles.histSub, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {h.analysis.overallSummary}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(h.id)}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.histDeleteBtn,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Feather name="trash-2" size={16} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {!active && history.length === 0 ? (
        <EmptyState
          icon="user"
          title="No analyses yet"
          description="Pick a photo above and tap Analyze to get your first reading."
        />
      ) : null}
    </ScrollView>
  );
}

function AnalysisCard({
  analysis,
  onDelete,
}: {
  analysis: StoredBodyAnalysis;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();
  const a = analysis.analysis;
  const date = new Date(analysis.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.resultHeader}>
        <Image
          source={{ uri: analysis.photoUris[0] }}
          style={styles.resultPhoto}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            {analysis.angle.toUpperCase()}
            {"  \u00B7  "}
            {date}
          </Text>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>
            {a.estimatedBodyFatRange} BF
            {"  \u00B7  "}
            Symmetry {a.estimatedSymmetryScore.toFixed(1)}/10
          </Text>
        </View>
        <Pressable
          onPress={() => onDelete(analysis.id)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.deletePill,
            {
              backgroundColor: colors.background,
              borderColor: colors.primary,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={14} color={colors.primary} />
          <Text style={[styles.deletePillText, { color: colors.primary }]}>
            Delete
          </Text>
        </Pressable>
      </View>

      {analysis.photoUris.length > 1 ? (
        <View style={styles.resultStrip}>
          {analysis.photoUris.slice(1).map((uri, i) => (
            <Image
              key={uri + ":" + i}
              source={{ uri }}
              style={[styles.resultStripImg, { borderColor: colors.border }]}
              resizeMode="cover"
            />
          ))}
        </View>
      ) : null}

      <Text style={[styles.resultBody, { color: colors.foreground }]}>
        {a.overallSummary}
      </Text>

      <Section title="STRENGTHS">
        {a.strengths.map((s, i) => (
          <BulletItem key={"s-" + i} text={s} />
        ))}
      </Section>

      <Section title="DEVELOPMENT AREAS">
        {a.developmentAreas.map((d, i) => (
          <View key={"d-" + i} style={styles.devRow}>
            <View
              style={[
                styles.devChip,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[styles.devChipText, { color: colors.primaryForeground }]}
                numberOfLines={1}
              >
                {d.muscle}
              </Text>
            </View>
            <Text style={[styles.devNote, { color: colors.foreground }]}>
              {d.note}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="RECOMMENDED EXERCISES">
        {a.recommendedExercises.map((r, i) => (
          <View key={"r-" + i} style={styles.recRow}>
            <Feather name="zap" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recName, { color: colors.foreground }]}>
                {r.name}
                <Text style={{ color: colors.mutedForeground }}>
                  {"  \u00B7  " + r.muscle}
                </Text>
              </Text>
              <Text
                style={[styles.recReason, { color: colors.mutedForeground }]}
              >
                {r.reason}
              </Text>
            </View>
          </View>
        ))}
      </Section>

      <Section title="POSTURE">
        <Text style={[styles.resultBody, { color: colors.foreground }]}>
          {a.postureNotes}
        </Text>
      </Section>

      <Section title="NUTRITION TIP">
        <Text style={[styles.resultBody, { color: colors.foreground }]}>
          {a.nutritionTip}
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
    <View style={{ gap: 6 }}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function BulletItem({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bullet, { color: colors.primary }]}>{"\u2022"}</Text>
      <Text style={[styles.bulletText, { color: colors.foreground }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
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
  cardLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  angleRow: {
    flexDirection: "row",
    gap: 8,
  },
  angleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  angleChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  pickRow: {
    flexDirection: "row",
    gap: 10,
  },
  pickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  resultCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  resultHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  resultPhoto: {
    width: 56,
    height: 72,
    borderRadius: 8,
  },
  resultTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  resultBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
  },
  bullet: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    lineHeight: 19,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  devRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  devChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 80,
    alignItems: "center",
  },
  devChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  devNote: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  recRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  recName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  recReason: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  histRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  histRowSelect: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 4,
  },
  histDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  deletePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deletePillText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  histThumb: {
    width: 44,
    height: 56,
    borderRadius: 6,
  },
  histCountBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  histCountText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    lineHeight: 12,
  },
  thumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumbWrap: {
    width: 84,
    height: 108,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "visible",
    position: "relative",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  resultStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resultStripImg: {
    width: 56,
    height: 72,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  histTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  histSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
