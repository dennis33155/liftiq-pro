import React from "react";
import { StyleSheet, View } from "react-native";

import { HeaderHomeButton } from "./HeaderHomeButton";
import { LiveDateTime } from "./LiveDateTime";

export function HeaderRight() {
  return (
    <View style={styles.row}>
      <LiveDateTime variant="stack" align="right" />
      <HeaderHomeButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 4,
  },
});
