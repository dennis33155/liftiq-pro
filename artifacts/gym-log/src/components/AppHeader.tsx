import { useLocation } from "wouter";
import { Activity } from "lucide-react";

export function AppHeader() {
  const [location] = useLocation();

  // Don't show header on workout screen, it has its own
  if (location === "/workout") return null;

  return (
    <header className="sticky top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center px-4 z-40">
      <div className="flex items-center gap-2">
        <Activity className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">GymLog</span>
      </div>
    </header>
  );
}
