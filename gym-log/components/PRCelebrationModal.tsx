import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { PRBeat } from "@/lib/prDetection";

const GOLD = "#facc15";
const GOLD_DEEP = "#b45309";

function formatPrevDate(ts: number | null): string {
  if (ts == null) return "no previous best";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  visible: boolean;
  exerciseName: string;
  beat: PRBeat | null;
  onDismiss: () => void;
};

export function PRCelebrationModal({
  visible,
  exerciseName,
  beat,
  onDismiss,
}: Props) {
  const colors = useColors();
  const flash = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) {
      flash.setValue(0);
      scale.setValue(0.85);
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0.55,
        duration: 380,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.spring(scale, {
      toValue: 1,
      damping: 8,
      stiffness: 110,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [visible, flash, scale, onDismiss]);

  if (!visible || !beat) return null;

  const { width, height } = Dimensions.get("window");

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable onPress={onDismiss} style={styles.backdrop}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flash,
            {
              width,
              height,
              backgroundColor: GOLD,
              opacity: flash,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: GOLD,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <Feather name="award" size={36} color={GOLD} />
          </View>
          <Text style={[styles.kicker, { color: GOLD }]}>
            NEW PERSONAL BEST
          </Text>
          <Text
            style={[styles.exerciseName, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {exerciseName}
          </Text>

          <View style={styles.statRow}>
            <Text style={[styles.statBig, { color: GOLD }]}>
              {beat.newWeight}
            </Text>
            <Text style={[styles.statUnit, { color: colors.foreground }]}>
              lb
            </Text>
            <Text style={[styles.statTimes, { color: colors.mutedForeground }]}>
              x
            </Text>
            <Text style={[styles.statBig, { color: GOLD }]}>
              {beat.newReps}
            </Text>
            <Text style={[styles.statUnit, { color: colors.foreground }]}>
              reps
            </Text>
          </View>

          <View
            style={[styles.prevWrap, { borderColor: colors.border }]}
          >
            <Text
              style={[styles.prevLabel, { color: colors.mutedForeground }]}
            >
              PREVIOUS BEST
            </Text>
            <Text style={[styles.prevValue, { color: colors.foreground }]}>
              {beat.prevWeight} lb x {beat.prevReps} reps
            </Text>
            <Text style={[styles.prevDate, { color: colors.mutedForeground }]}>
              {formatPrevDate(beat.prevDate)}
            </Text>
          </View>

          <Text style={[styles.dismissHint, { color: GOLD_DEEP }]}>
            Tap anywhere to dismiss
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  flash: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  card: {
    borderRadius: 22,
    borderWidth: 2,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 380,
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(250, 204, 21, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 4,
  },
  exerciseName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 6,
  },
  statBig: {
    fontFamily: "Inter_700Bold",
    fontSize: 44,
    letterSpacing: -1,
  },
  statUnit: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  statTimes: {
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    paddingHorizontal: 4,
  },
  prevWrap: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  prevLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
  },
  prevValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  prevDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  dismissHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 8,
    opacity: 0.85,
  },
});
