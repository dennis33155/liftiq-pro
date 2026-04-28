import { useState, useEffect, useRef } from "react";
import { Play, Square, Plus, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface RestTimerProps {
  defaultRest: number;
}

export function RestTimer({ defaultRest }: RestTimerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  // Expose a global way to start the timer (hacky but works for this specific mobile UI without complex context)
  useEffect(() => {
    const handleStartTimer = (e: CustomEvent<{ seconds: number }>) => {
      setTimeLeft(e.detail.seconds);
      setIsActive(true);
      setIsOpen(true);
    };
    
    window.addEventListener("start-rest-timer" as any, handleStartTimer);
    return () => window.removeEventListener("start-rest-timer" as any, handleStartTimer);
  }, []);

  useEffect(() => {
    let interval: number;
    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
      playBeep();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Audio context might be blocked
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const adjustTime = (amount: number) => {
    setTimeLeft((prev) => Math.max(0, prev + amount));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-card border shadow-xl rounded-full px-4 py-2 flex items-center gap-4"
      >
        <div className="text-xl font-mono font-bold w-16 text-center tabular-nums text-primary">
          {formatTime(timeLeft)}
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => adjustTime(-15)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => adjustTime(15)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {isActive ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => setIsActive(false)}>
            <Square className="h-4 w-4" fill="currentColor" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-green-500" onClick={() => setIsActive(true)}>
            <Play className="h-4 w-4" fill="currentColor" />
          </Button>
        )}
        
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full ml-1" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </motion.div>
    </div>
  );
}

export function startRestTimer(seconds: number) {
  window.dispatchEvent(new CustomEvent("start-rest-timer", { detail: { seconds } }));
}
