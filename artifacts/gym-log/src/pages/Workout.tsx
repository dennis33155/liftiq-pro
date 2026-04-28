import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Play, Check, Plus, Trash2, Clock, X, Info } from "lucide-react";
import { storage } from "@/lib/storage";
import { Workout, SetEntry, WorkoutExercise, Exercise } from "@/lib/types";
import { suggestNextSet } from "@/lib/progression";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetRow } from "@/components/SetRow";
import { AddExerciseSheet } from "@/components/AddExerciseSheet";
import { ExerciseDetailDialog } from "@/components/ExerciseDetailDialog";
import { ExerciseImage } from "@/components/ExerciseImage";
import { RestTimer, startRestTimer } from "@/components/RestTimer";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function WorkoutScreen() {
  const [, setLocation] = useLocation();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const settings = storage.getSettings();
  
  const exercisesDict = useMemo(() => {
    const list = storage.getExercises();
    return list.reduce((acc, ex) => {
      acc[ex.id] = ex;
      return acc;
    }, {} as Record<string, Exercise>);
  }, []);

  useEffect(() => {
    const active = storage.getActiveWorkout();
    if (!active) {
      setLocation("/");
      return;
    }
    setWorkout(active);
  }, [setLocation]);

  useEffect(() => {
    if (!workout) return;
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - workout.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workout]);

  // Persist on change
  useEffect(() => {
    if (workout) {
      storage.saveActiveWorkout(workout);
    }
  }, [workout]);

  const updateWorkout = (updater: (prev: Workout) => Workout) => {
    setWorkout(prev => {
      if (!prev) return prev;
      return updater(prev);
    });
  };

  const handleAddExercise = (exerciseId: string) => {
    updateWorkout(prev => {
      const history = storage.getHistory()[exerciseId];
      const suggestion = suggestNextSet(history, settings);
      
      const initialSet: SetEntry = {
        id: `set-${Date.now()}`,
        weight: suggestion.weight || 0,
        reps: suggestion.reps || 0,
        done: false
      };

      return {
        ...prev,
        exercises: [
          ...prev.exercises,
          { exerciseId, sets: [initialSet] }
        ]
      };
    });
  };

  const handleRemoveExercise = (exerciseId: string) => {
    if (!confirm("Remove this exercise?")) return;
    updateWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.filter(e => e.exerciseId !== exerciseId)
    }));
  };

  const handleAddSet = (exerciseId: string) => {
    updateWorkout(prev => {
      return {
        ...prev,
        exercises: prev.exercises.map(ex => {
          if (ex.exerciseId !== exerciseId) return ex;
          const lastSet = ex.sets[ex.sets.length - 1];
          const newSet: SetEntry = {
            id: `set-${Date.now()}`,
            weight: lastSet ? lastSet.weight : 0,
            reps: lastSet ? lastSet.reps : 0,
            done: false
          };
          return { ...ex, sets: [...ex.sets, newSet] };
        })
      };
    });
  };

  const handleUpdateSet = (exerciseId: string, setId: string, updates: Partial<SetEntry>) => {
    updateWorkout(prev => {
      return {
        ...prev,
        exercises: prev.exercises.map(ex => {
          if (ex.exerciseId !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map(s => s.id === setId ? { ...s, ...updates } : s)
          };
        })
      };
    });
  };

  const handleSetDone = (exerciseId: string, setId: string, done: boolean) => {
    handleUpdateSet(exerciseId, setId, { done });
    if (done) {
      startRestTimer(settings.defaultRest);
      // Tasteful subtle haptic simulation via visual flash could go here
    }
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleFinish = () => {
    if (!workout) return;
    
    const completedWorkout: Workout = {
      ...workout,
      endedAt: Date.now(),
      exercises: workout.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => s.done)
      })).filter(ex => ex.sets.length > 0) // only keep exercises with completed sets
    };

    if (completedWorkout.exercises.length === 0) {
      if (!confirm("No sets completed. Discard workout?")) return;
      storage.saveActiveWorkout(null);
      setLocation("/");
      return;
    }

    // Save to history
    const workouts = storage.getWorkouts();
    storage.saveWorkouts([completedWorkout, ...workouts]);
    storage.saveActiveWorkout(null);

    // Update exercise history (personal records / last sets)
    const history = storage.getHistory();
    completedWorkout.exercises.forEach(ex => {
      const lastSet = ex.sets[ex.sets.length - 1];
      if (lastSet) {
        history[ex.exerciseId] = {
          exerciseId: ex.exerciseId,
          lastWeight: lastSet.weight,
          lastReps: lastSet.reps,
          lastUnit: workout.unit,
          lastDate: completedWorkout.endedAt || Date.now()
        };
      }
    });
    storage.saveHistory(history);
    
    toast.success("Workout saved!");
    setLocation("/");
  };

  const handleDiscard = () => {
    if (confirm("Discard this workout completely?")) {
      storage.saveActiveWorkout(null);
      setLocation("/");
    }
  };

  if (!workout) return null;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 h-14 border-b border-border flex items-center justify-between px-4 bg-card sticky top-0 z-30">
        <div className="font-bold text-lg">{workout.category}</div>
        <div className="flex items-center gap-2 text-primary font-mono text-lg font-semibold tabular-nums">
          <Clock className="w-4 h-4" />
          {formatElapsed(elapsed)}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6 pb-32">
        <AnimatePresence initial={false}>
          {workout.exercises.map(ex => {
            const exerciseDef = exercisesDict[ex.exerciseId];
            if (!exerciseDef) return null;

            return (
              <motion.div 
                key={ex.exerciseId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              >
                <Card className="overflow-hidden border-border/50 shadow-sm">
                  <div className="p-3 border-b border-border/50 bg-muted/10 flex items-center gap-3">
                    <button onClick={() => setDetailExercise(exerciseDef)} className="shrink-0 relative rounded-md overflow-hidden active:scale-95 transition-transform">
                      <ExerciseImage src={exerciseDef.imageUrl} alt={exerciseDef.name} muscle={exerciseDef.primaryMuscle} className="w-12 h-12" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
                        <Info className="w-4 h-4 text-white" />
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate text-base leading-tight">{exerciseDef.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{exerciseDef.primaryMuscle}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleRemoveExercise(ex.exerciseId)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    <div className="flex items-center px-2 text-xs font-medium text-muted-foreground mb-2">
                      <div className="w-8 text-center">Set</div>
                      <div className="flex-1 text-center">kg</div>
                      <div className="flex-1 text-center">Reps</div>
                      <div className="w-12 text-center">
                        <Check className="w-4 h-4 mx-auto opacity-50" />
                      </div>
                    </div>
                    
                    {ex.sets.map((set, i) => (
                      <SetRow 
                        key={set.id}
                        index={i}
                        set={set}
                        updateSet={(id, updates) => handleUpdateSet(ex.exerciseId, id, updates)}
                        onDone={(done) => handleSetDone(ex.exerciseId, set.id, done)}
                      />
                    ))}
                    
                    <Button 
                      variant="ghost" 
                      className="w-full mt-2 text-muted-foreground hover:text-foreground h-10 border border-dashed border-border/50"
                      onClick={() => handleAddSet(ex.exerciseId)}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Set
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <Button 
          variant="outline" 
          className="w-full h-14 text-lg font-semibold bg-card border-primary/20 text-primary hover:bg-primary/10 shadow-sm"
          onClick={() => setAddExerciseOpen(true)}
        >
          <Plus className="w-5 h-5 mr-2" /> Add Exercise
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-lg border-t border-border z-20 flex gap-3 pb-safe">
        <Button variant="destructive" className="flex-1 h-14 font-semibold text-lg" onClick={handleDiscard}>
          Discard
        </Button>
        <Button className="flex-[2] h-14 font-bold text-lg shadow-md" onClick={handleFinish}>
          Finish Workout
        </Button>
      </div>

      <RestTimer defaultRest={settings.defaultRest} />
      <AddExerciseSheet open={addExerciseOpen} onOpenChange={setAddExerciseOpen} onAdd={handleAddExercise} categoryFilter={workout.category} />
      <ExerciseDetailDialog exercise={detailExercise} open={!!detailExercise} onOpenChange={(open) => !open && setDetailExercise(null)} />
    </div>
  );
}
