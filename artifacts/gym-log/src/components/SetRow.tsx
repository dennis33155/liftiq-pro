import { Check } from "lucide-react";
import { SetEntry } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SetRowProps {
  index: number;
  set: SetEntry;
  updateSet: (id: string, updates: Partial<SetEntry>) => void;
  onDone: (done: boolean) => void;
}

export function SetRow({ index, set, updateSet, onDone }: SetRowProps) {
  return (
    <motion.div 
      initial={false}
      animate={{ backgroundColor: set.done ? "var(--color-muted)" : "transparent" }}
      className="flex items-center gap-2 py-1 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="w-8 text-center text-sm font-medium text-muted-foreground">
        {index + 1}
      </div>
      
      <div className="flex-1 relative">
        <Input
          type="number"
          inputMode="decimal"
          value={set.weight || ""}
          onChange={(e) => updateSet(set.id, { weight: parseFloat(e.target.value) || 0 })}
          className={cn(
            "text-center font-semibold text-lg h-11 bg-transparent border-0 focus-visible:ring-1",
            set.done && "opacity-50"
          )}
          placeholder="-"
          disabled={set.done}
        />
      </div>
      
      <div className="flex-1 relative">
        <Input
          type="number"
          inputMode="numeric"
          value={set.reps || ""}
          onChange={(e) => updateSet(set.id, { reps: parseInt(e.target.value, 10) || 0 })}
          className={cn(
            "text-center font-semibold text-lg h-11 bg-transparent border-0 focus-visible:ring-1",
            set.done && "opacity-50"
          )}
          placeholder="-"
          disabled={set.done}
        />
      </div>
      
      <div className="w-12 flex justify-center">
        <button
          onClick={() => onDone(!set.done)}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center transition-all",
            set.done 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          {set.done && <Check className="w-5 h-5" />}
        </button>
      </div>
    </motion.div>
  );
}
