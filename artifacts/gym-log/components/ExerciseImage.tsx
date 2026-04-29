import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Category, Exercise } from "@/lib/types";

type Props = {
  size?: number;
  exercise?: Pick<Exercise, "category" | "equipment" | "imageUrl"> | null;
  large?: boolean;
};

const CATEGORY_GRADIENT: Record<Category, [string, string]> = {
  Chest: ["#1e3a8a", "#2979FF"],
  Back: ["#0e2a47", "#1d4ed8"],
  Arms: ["#1e293b", "#3b82f6"],
  Shoulders: ["#0f172a", "#0ea5e9"],
  Legs: ["#172554", "#2563eb"],
  "Full Body": ["#1f2937", "#3b82f6"],
};

type IconKind = "barbell" | "dumbbell" | "cable" | "machine" | "body";

function pickIcon(equipment: string | undefined): IconKind {
  if (!equipment) return "machine";
  const e = equipment.toLowerCase();
  if (e.includes("barbell")) return "barbell";
  if (e.includes("dumbbell") || e.includes("kettlebell")) return "dumbbell";
  if (e.includes("cable") || e.includes("rope")) return "cable";
  if (
    e.includes("body") ||
    e.includes("none") ||
    e.includes("self") ||
    e.includes("pull-up bar") ||
    e.includes("dip")
  )
    return "body";
  return "machine";
}

function IconForKind({ kind, size }: { kind: IconKind; size: number }) {
  const color = "#fafafa";
  switch (kind) {
    case "barbell":
      return (
        <MaterialCommunityIcons name="weight-lifter" size={size} color={color} />
      );
    case "dumbbell":
      return (
        <MaterialCommunityIcons name="dumbbell" size={size} color={color} />
      );
    case "cable":
      return <Feather name="zap" size={size * 0.85} color={color} />;
    case "body":
      return (
        <MaterialCommunityIcons name="human-handsup" size={size} color={color} />
      );
    case "machine":
    default:
      return (
        <MaterialCommunityIcons name="cog-outline" size={size} color={color} />
      );
  }
}

export function ExerciseImage({ size = 44, exercise, large = false }: Props) {
  const colors = useColors();
  const [imgFailed, setImgFailed] = React.useState(false);
  const category = exercise?.category;
  const gradient: [string, string] = category
    ? CATEGORY_GRADIENT[category]
    : [colors.accent, colors.accent];

  React.useEffect(() => {
    setImgFailed(false);
  }, [exercise?.imageUrl]);

  if (exercise?.imageUrl && !imgFailed) {
    return (
      <ExpoImage
        source={{ uri: exercise.imageUrl }}
        onError={() => setImgFailed(true)}
        style={
          large
            ? { width: "100%", height: 240, borderRadius: 16 }
            : {
                width: size,
                height: size,
                borderRadius: 12,
                backgroundColor: colors.accent,
              }
        }
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  if (large) {
    const iconSize = 96;
    return (
      <View
        style={[
          styles.large,
          { borderColor: colors.border, backgroundColor: gradient[0] },
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <IconForKind kind={pickIcon(exercise?.equipment)} size={iconSize} />
      </View>
    );
  }

  const iconSize = Math.round(size * 0.55);
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: 12,
          borderColor: colors.border,
          backgroundColor: gradient[0],
        },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
      />
      <IconForKind kind={pickIcon(exercise?.equipment)} size={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  large: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 16,
  },
});
