import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
import {
  addProgressPhoto,
  deleteProgressPhoto,
  loadProgressPhotos,
  type ProgressPhoto,
} from "@/lib/progressPhotos";

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
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);

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
              })
              .catch(() => {});
          },
        },
      ]);
    },
    [viewing],
  );

  const groups = useMemo(() => groupByDay(photos), [photos]);

  const screenWidth = Dimensions.get("window").width;
  const cellSize =
    (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

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
            disabled={adding}
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
            disabled={adding}
            variant="secondary"
            icon={
              <Feather name="image" size={16} color={colors.foreground} />
            }
            style={{ flex: 1 }}
          />
        </View>

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
              <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>
                {formatDateLong(group.date).toUpperCase()}{"  \u00B7  "}
                {group.photos.length}{" "}
                {group.photos.length === 1 ? "photo" : "photos"}
              </Text>
              <View style={styles.grid}>
                {group.photos.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setViewing(p)}
                    onLongPress={() => handleDelete(p.id)}
                    delayLongPress={400}
                    style={({ pressed }) => [
                      {
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 10,
                        overflow: "hidden",
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: colors.muted,
                      },
                    ]}
                  >
                    <ExpoImage
                      source={{ uri: p.uri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </Pressable>
                ))}
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
        <Pressable
          style={styles.viewerBackdrop}
          onPress={() => setViewing(null)}
        >
          {viewing ? (
            <>
              <ExpoImage
                source={{ uri: viewing.uri }}
                style={styles.viewerImage}
                contentFit="contain"
              />
              <View
                style={[
                  styles.viewerMeta,
                  { paddingBottom: insets.bottom + 16 },
                ]}
              >
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
            </>
          ) : null}
        </Pressable>
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
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: "100%",
    height: "85%",
  },
  viewerMeta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewerDate: {
    color: "#fafafa",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
