import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HeaderRight } from "@/components/HeaderRight";
import { WorkoutProvider } from "@/context/WorkoutContext";
import { AiUsageProvider } from "@/lib/aiUsage";
import { CustomScheduleProvider } from "@/lib/customSchedule";
import { ExerciseImagesProvider } from "@/lib/exerciseImages";
import { SubscriptionProvider } from "@/lib/subscription";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#fafafa",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="workout"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="exercise-picker"
        options={{
          presentation: "modal",
          title: "Add Exercise",
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="custom-exercise"
        options={{
          presentation: "modal",
          title: "New Custom Exercise",
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="workout-detail/[id]"
        options={{
          title: "Workout",
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="exercise-detail/[id]"
        options={{
          presentation: "modal",
          title: "Exercise",
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="pr-history/[id]"
        options={{
          title: "PR History",
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="body-metrics"
        options={{
          title: "Body Metrics",
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="progress-photos"
        options={{
          title: "Progress Photos",
          headerRight: () => <HeaderRight />,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
            <KeyboardProvider>
              <WorkoutProvider>
                <CustomScheduleProvider>
                  <ExerciseImagesProvider>
                    <SubscriptionProvider>
                      <AiUsageProvider>
                        <StatusBar style="light" />
                        <RootLayoutNav />
                      </AiUsageProvider>
                    </SubscriptionProvider>
                  </ExerciseImagesProvider>
                </CustomScheduleProvider>
              </WorkoutProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
