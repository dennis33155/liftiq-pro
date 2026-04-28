import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, PlayCircle } from "lucide-react";
import { Category, Workout } from "@/lib/types";
import { storage } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CATEGORIES: { name: Category; color: string }[] = [
  { name: "Chest", color: "from-red-900/50 to-red-950/20" },
  { name: "Back", color: "from-blue-900/50 to-blue-950/20" },
  { name: "Legs", color: "from-emerald-900/50 to-emerald-950/20" },
  { name: "Arms", color: "from-purple-900/50 to-purple-950/20" },
  { name: "Shoulders", color: "from-orange-900/50 to-orange-950/20" },
  { name: "Full Body", color: "from-slate-800/50 to-slate-900/20" },
];

export function Home() {
  const [, setLocation] = useLocation();
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    setActiveWorkout(storage.getActiveWorkout());
  }, []);

  const handleStart = (category: Category) => {
    if (activeWorkout) {
      if (!confirm("You have an active workout. Starting a new one will discard it. Continue?")) {
        return;
      }
    }
    
    const settings = storage.getSettings();
    const newWorkout: Workout = {
      id: `wk-${Date.now()}`,
      category,
      startedAt: Date.now(),
      unit: settings.unit,
      exercises: []
    };
    
    storage.saveActiveWorkout(newWorkout);
    setLocation("/workout");
  };

  return (
    <div className="flex-1 px-4 py-6 pb-24 overflow-y-auto space-y-8">
      {activeWorkout && (
        <Card className="p-4 bg-primary/10 border-primary/20 flex items-center justify-between shadow-none">
          <div>
            <h3 className="font-semibold text-primary">Workout in progress</h3>
            <p className="text-sm text-muted-foreground">{activeWorkout.category} session</p>
          </div>
          <Button onClick={() => setLocation("/workout")} className="shrink-0 gap-2 shadow-sm">
            Resume <Play className="w-4 h-4" />
          </Button>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4 tracking-tight">Start Session</h2>
        <div className="grid grid-cols-2 gap-4">
          {CATEGORIES.map(c => (
            <button
              key={c.name}
              onClick={() => handleStart(c.name)}
              className={`relative overflow-hidden aspect-[4/3] rounded-2xl flex flex-col items-start justify-end p-4 text-left transition-transform active:scale-95 bg-gradient-to-br ${c.color} border border-border/50`}
            >
              <span className="font-bold text-lg relative z-10">{c.name}</span>
              <PlayCircle className="absolute top-4 right-4 w-6 h-6 opacity-30" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
