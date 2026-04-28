import { Link, useLocation } from "wouter";
import { Home, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  // Hide on active workout screen
  if (location === "/workout") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-4 pb-safe z-40">
      <Link href="/" className={cn("flex flex-col items-center justify-center w-16 h-full text-muted-foreground transition-colors", location === "/" && "text-primary")}>
        <Home className="w-6 h-6" />
        <span className="text-[10px] font-medium mt-1">Home</span>
      </Link>
      
      <Link href="/history" className={cn("flex flex-col items-center justify-center w-16 h-full text-muted-foreground transition-colors", location === "/history" && "text-primary")}>
        <History className="w-6 h-6" />
        <span className="text-[10px] font-medium mt-1">History</span>
      </Link>
      
      <Link href="/settings" className={cn("flex flex-col items-center justify-center w-16 h-full text-muted-foreground transition-colors", location === "/settings" && "text-primary")}>
        <Settings className="w-6 h-6" />
        <span className="text-[10px] font-medium mt-1">Settings</span>
      </Link>
    </div>
  );
}
