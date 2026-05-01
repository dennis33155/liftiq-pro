import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

export type LineChartPoint = { x: number; y: number };

type Props = {
  data: LineChartPoint[];
  height?: number;
  width: number;
  yLabel?: string;
  xFormatter?: (x: number) => string;
  yFormatter?: (y: number) => string;
  showDots?: boolean;
};

const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export function SimpleLineChart({
  data,
  height = 180,
  width,
  yLabel,
  xFormatter,
  yFormatter,
  showDots = true,
}: Props) {
  const colors = useColors();

  if (data.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { height, borderColor: colors.border, backgroundColor: colors.muted },
        ]}
      >
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No data yet.
        </Text>
      </View>
    );
  }

  const innerW = Math.max(10, width - PAD_LEFT - PAD_RIGHT);
  const innerH = Math.max(10, height - PAD_TOP - PAD_BOTTOM);

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xSpan = maxX - minX || 1;
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY = minY - 1;
    maxY = maxY + 1;
  }
  const ySpan = maxY - minY || 1;

  const project = (p: LineChartPoint): { px: number; py: number } => {
    const px =
      data.length === 1
        ? PAD_LEFT + innerW / 2
        : PAD_LEFT + ((p.x - minX) / xSpan) * innerW;
    const py = PAD_TOP + innerH - ((p.y - minY) / ySpan) * innerH;
    return { px, py };
  };

  const projected = data.map(project);

  const path = projected
    .map((p, i) => (i === 0 ? "M" : "L") + p.px.toFixed(1) + " " + p.py.toFixed(1))
    .join(" ");

  const ticksY = 3;
  const yTickValues: number[] = [];
  for (let i = 0; i <= ticksY; i += 1) {
    yTickValues.push(minY + (ySpan * i) / ticksY);
  }

  const formatY = (v: number): string => (yFormatter ? yFormatter(v) : v.toFixed(0));
  const formatX = (v: number): string => (xFormatter ? xFormatter(v) : "");

  const firstX = data[0].x;
  const lastX = data[data.length - 1].x;

  return (
    <View>
      <Svg width={width} height={height}>
        {yTickValues.map((tv, i) => {
          const py = PAD_TOP + innerH - ((tv - minY) / ySpan) * innerH;
          return (
            <React.Fragment key={"tick-" + i}>
              <Line
                x1={PAD_LEFT}
                x2={PAD_LEFT + innerW}
                y1={py}
                y2={py}
                stroke={colors.border}
                strokeWidth={0.5}
              />
              <SvgText
                x={PAD_LEFT - 4}
                y={py + 3}
                fontSize={9}
                fill={colors.mutedForeground}
                textAnchor="end"
              >
                {formatY(tv)}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Path
          d={path}
          stroke={colors.primary}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showDots
          ? projected.map((p, i) => (
              <Circle
                key={"dot-" + i}
                cx={p.px}
                cy={p.py}
                r={3}
                fill={colors.primary}
              />
            ))
          : null}

        {data.length > 1 ? (
          <>
            <SvgText
              x={PAD_LEFT}
              y={height - 6}
              fontSize={9}
              fill={colors.mutedForeground}
              textAnchor="start"
            >
              {formatX(firstX)}
            </SvgText>
            <SvgText
              x={PAD_LEFT + innerW}
              y={height - 6}
              fontSize={9}
              fill={colors.mutedForeground}
              textAnchor="end"
            >
              {formatX(lastX)}
            </SvgText>
          </>
        ) : (
          <SvgText
            x={PAD_LEFT + innerW / 2}
            y={height - 6}
            fontSize={9}
            fill={colors.mutedForeground}
            textAnchor="middle"
          >
            {formatX(firstX)}
          </SvgText>
        )}
      </Svg>
      {yLabel ? (
        <Text style={[styles.yLabel, { color: colors.mutedForeground }]}>
          {yLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  yLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    marginTop: 4,
    textAlign: "center",
  },
});
