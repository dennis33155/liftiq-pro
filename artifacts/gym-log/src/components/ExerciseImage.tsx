import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseImageProps {
  src?: string;
  alt: string;
  muscle: string;
  className?: string;
}

export function ExerciseImage({ src, alt, muscle, className }: ExerciseImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-muted text-muted-foreground rounded-md", className)}>
        <Dumbbell className="w-6 h-6 mb-1 opacity-50" />
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{muscle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={cn("object-cover rounded-md", className)}
    />
  );
}
