import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { formatTimer } from "@/lib/format";

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
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setSecondsLeft(initialSeconds);
      setPaused(false);
      finishedRef.current = false;
    }
  }, [visible, initialSeconds, restartToken]);

  useEffect(() => {
    if (!visible || paused) {
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  }, [visible, paused]);

  const adjust = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSecondsLeft((s) => Math.max(0, s + delta));
    finishedRef.current = false;
  };

  const togglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaused((p) => !p);
  };

  const handleClose = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss rest timer"
        accessibilityHint="Closes the rest timer modal"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: 24,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.mutedForeground }]}>
            REST
          </Text>
          <Text
            style={[
              styles.timer,
              {
                color: secondsLeft === 0 ? colors.success : colors.foreground,
              },
            ]}
          >
            {formatTimer(secondsLeft)}
          </Text>

          <View style={styles.adjustRow}>
            <Pressable
              onPress={() => adjust(-15)}
              style={({ pressed }) => [
                styles.adjustBtn,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.adjustLabel, { color: colors.foreground }]}>
                -15s
              </Text>
            </Pressable>
            <Pressable
              onPress={() => adjust(15)}
              style={({ pressed }) => [
                styles.adjustBtn,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.adjustLabel, { color: colors.foreground }]}>
                +15s
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={togglePause}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name={paused ? "play" : "pause"}
                size={22}
                color={colors.foreground}
              />
            </Pressable>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.skipBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[styles.skipLabel, { color: colors.primaryForeground }]}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    padding: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  timer: {
    fontFamily: "Inter_700Bold",
    fontSize: 64,
    fontVariant: ["tabular-nums"],
    marginBottom: 24,
  },
  adjustRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  adjustBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  adjustLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  actionRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  iconBtn: {
    width: 56,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
