import { Exercise } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ExerciseImage } from "./ExerciseImage";
import { Badge } from "@/components/ui/badge";

interface ExerciseDetailDialogProps {
  exercise: Exercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseDetailDialog({ exercise, open, onOpenChange }: ExerciseDetailDialogProps) {
  if (!exercise) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] p-0 overflow-hidden bg-card border-border rounded-xl">
        <ExerciseImage 
          src={exercise.imageUrl} 
          alt={exercise.name} 
          muscle={exercise.primaryMuscle}
          className="w-full h-64 rounded-none"
        />
        
        <div className="p-6">
          <DialogHeader className="text-left mb-4">
            <DialogTitle className="text-2xl font-bold">{exercise.name}</DialogTitle>
            {exercise.aka && (
              <DialogDescription className="text-base mt-1">
                Aka: {exercise.aka}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Primary Muscle</h4>
              <Badge variant="secondary" className="text-sm px-3 py-1 bg-primary/20 text-primary border-0">
                {exercise.primaryMuscle}
              </Badge>
            </div>

            {exercise.secondaryMuscles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Secondary Muscles</h4>
                <div className="flex flex-wrap gap-2">
                  {exercise.secondaryMuscles.map(m => (
                    <Badge key={m} variant="outline" className="text-sm px-3 py-1">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
