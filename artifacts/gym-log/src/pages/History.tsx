import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Dumbbell, Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { storage } from "@/lib/storage";
import { Workout } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function History() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const exercises = useMemo(() => storage.getExercises(), []);

  useEffect(() => {
    setWorkouts(storage.getWorkouts());
  }, []);

  const getExerciseName = (id: string) => {
    return exercises.find(e => e.id === id)?.name || "Unknown Exercise";
  };

  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 text-center space-y-4 pb-24 h-[80vh]">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">No history yet</h2>
        <p className="text-muted-foreground">Your completed workouts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-6 pb-24 overflow-y-auto space-y-4">
      <h2 className="text-2xl font-bold mb-6 tracking-tight">History</h2>
      
      {workouts.map(w => {
        const duration = w.endedAt ? Math.floor((w.endedAt - w.startedAt) / 60000) : 0;
        const totalSets = w.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);
        let volume = 0;
        w.exercises.forEach(ex => {
          ex.sets.filter(s => s.done).forEach(s => {
            volume += s.weight * s.reps;
          });
        });

        const isExpanded = expandedId === w.id;

        return (
          <Card 
            key={w.id} 
            className="overflow-hidden border-border/50 transition-colors"
            onClick={() => setExpandedId(isExpanded ? null : w.id)}
          >
            <CardContent className="p-0">
              <div className="p-4 flex items-center justify-between cursor-pointer">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{w.category}</h3>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs font-normal px-2 py-0.5">
                      {w.unit}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(w.startedAt, "MMM d, yyyy")}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {duration} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{totalSets} sets</p>
                    <p className="text-xs text-muted-foreground">{volume.toLocaleString()} vol</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-border/50 bg-muted/20 p-4 space-y-4">
                  {w.exercises.map(ex => {
                    const doneSets = ex.sets.filter(s => s.done);
                    if (doneSets.length === 0) return null;
                    return (
                      <div key={ex.exerciseId}>
                        <h4 className="font-medium text-sm mb-2">{getExerciseName(ex.exerciseId)}</h4>
                        <div className="space-y-1">
                          {doneSets.map((s, i) => (
                            <div key={s.id} className="flex text-sm text-muted-foreground pl-2 border-l-2 border-primary/30">
                              <span className="w-6">{i + 1}</span>
                              <span>{s.weight} {w.unit} x {s.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
