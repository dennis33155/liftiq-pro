import { ExerciseHistoryEntry, Settings } from "./types";

export function suggestNextSet(historyEntry: ExerciseHistoryEntry | undefined, settings: Settings) {
  if (!historyEntry) {
    return { weight: 0, reps: 0 };
  }

  let { lastWeight, lastReps, lastUnit } = historyEntry;

  // Convert weight if settings unit changed
  let currentWeight = lastWeight;
  if (lastUnit !== settings.unit) {
    if (settings.unit === "kg" && lastUnit === "lb") {
      currentWeight = lastWeight / 2.20462;
    } else if (settings.unit === "lb" && lastUnit === "kg") {
      currentWeight = lastWeight * 2.20462;
    }
  }

  const step = settings.unit === "kg" ? 2.5 : 5;
  
  // Suggest a slight progression in weight, keep reps same
  const suggestedWeight = Math.ceil(currentWeight / step) * step;

  return {
    weight: suggestedWeight,
    reps: lastReps
  };
}
