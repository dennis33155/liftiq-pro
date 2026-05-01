import { Feather } from "@expo/vector-icons";
import { AudioModule, createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { formatTimer } from "@/lib/format";

const REST_END_SOUND = require("../assets/audio/rest-end.wav");

const FINISHED_MESSAGES = [
  "Time to lift.",
  "Rest is over. Back to work.",
  "Up. Next set.",
  "Move. Don't think.",
];

type Props = {
  visible: boolean;
  initialSeconds: number;
  /**
   * Increment to force-restart the countdown even if `visible` was already
   * true (e.g. user marks another set done while the timer is still
   * running).
   */
  restartToken?: number;
  onClose: () => void;
};

export function RestTimer({
  visible,
  initialSeconds,
  restartToken = 0,
  onClose,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [finishedMsgIdx, setFinishedMsgIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    AudioModule.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    }).catch(() => {});
    const p = createAudioPlayer(REST_END_SOUND);
    playerRef.current = p;
    return () => {
      p.remove();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setSecondsLeft(initialSeconds);
      finishedRef.current = false;
      setFinishedMsgIdx(Math.floor(Math.random() * FINISHED_MESSAGES.length));
    }
  }, [visible, initialSeconds, restartToken]);

  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
            try {
              const p = playerRef.current;
              if (p) {
                p.seekTo(0).catch(() => {});
                p.play();
              }
            } catch {
              // ignore audio failure
            }
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, restartToken]);

  const addThirty = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSecondsLeft((s) => s + 30);
    finishedRef.current = false;
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onClose();
  };

  const isDone = secondsLeft === 0;
  const finishedMessage = useMemo(
    () => FINISHED_MESSAGES[finishedMsgIdx] ?? FINISHED_MESSAGES[0]!,
    [finishedMsgIdx],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.fullscreen,
          {
            backgroundColor: isDone ? "#0a1f3d" : "#000",
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={handleClose}
            hitSlop={16}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Close rest timer"
          >
            <Feather name="x" size={28} color="#fafafa" />
          </Pressable>
          <Text style={styles.headerTitle}>REST TIME</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.center}>
          {isDone ? (
            <>
              <Text style={[styles.doneTitle, { color: colors.primary }]}>
                {finishedMessage}
              </Text>
              <Text style={styles.timerDone}>00:00</Text>
            </>
          ) : (
            <>
              <Text style={styles.timerLabel}>NEXT SET IN</Text>
              <Text style={styles.timer}>{formatTimer(secondsLeft)}</Text>
            </>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={addThirty}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: "#3a3a3a",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add 30 seconds"
          >
            <Feather name="plus" size={18} color="#fafafa" />
            <Text style={styles.secondaryLabel}>Add 30 sec</Text>
          </Pressable>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: isDone ? colors.primary : "#f97316",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Skip rest"
          >
            <Feather
              name={isDone ? "play" : "skip-forward"}
              size={20}
              color="#fafafa"
            />
            <Text style={styles.primaryLabel}>
              {isDone ? "Lift Now" : "Skip Rest"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fafafa",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: 3,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  timerLabel: {
    color: "#a1a1aa",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 16,
  },
  timer: {
    color: "#fafafa",
    fontFamily: "Inter_700Bold",
    fontSize: 124,
    fontVariant: ["tabular-nums"],
    letterSpacing: -3,
    lineHeight: 130,
  },
  timerDone: {
    color: "#fafafa",
    fontFamily: "Inter_700Bold",
    fontSize: 84,
    fontVariant: ["tabular-nums"],
    marginTop: 12,
    opacity: 0.6,
  },
  doneTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  actions: {
    gap: 12,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryLabel: {
    color: "#fafafa",
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 22,
    borderRadius: 16,
  },
  primaryLabel: {
    color: "#fafafa",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
});
