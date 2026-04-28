import { useState, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Exercise, Category } from "@/lib/types";
import { ExerciseImage } from "./ExerciseImage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { storage } from "@/lib/storage";
import { CustomExerciseSheet } from "./CustomExerciseSheet";

interface AddExerciseSheetProps {
  categoryFilter?: Category;
  onAdd: (exerciseId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExerciseSheet({ categoryFilter, onAdd, open, onOpenChange }: AddExerciseSheetProps) {
  const [search, setSearch] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const exercises = storage.getExercises();

  const filtered = useMemo(() => {
    return exercises.filter(ex => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) || 
                           (ex.aka && ex.aka.toLowerCase().includes(search.toLowerCase()));
      // Allow browsing all if searching, otherwise prioritize category
      if (search) return matchesSearch;
      if (categoryFilter && ex.category !== categoryFilter) return false;
      return true;
    });
  }, [exercises, search, categoryFilter]);

  const handleAdd = (id: string) => {
    onAdd(id);
    onOpenChange(false);
    setSearch("");
  };

  const handleCustomCreated = (id: string) => {
    onAdd(id);
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="text-left border-b pb-4">
            <DrawerTitle className="text-xl">Add Exercise</DrawerTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search exercises..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </DrawerHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2 pb-8">
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAdd(ex.id)}
                  className="w-full flex items-center gap-4 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <ExerciseImage src={ex.imageUrl} alt={ex.name} muscle={ex.primaryMuscle} className="w-12 h-12 rounded-md shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-semibold truncate">{ex.name}</h4>
                    <p className="text-xs text-muted-foreground truncate">{ex.primaryMuscle}</p>
                  </div>
                  <Plus className="w-5 h-5 text-primary shrink-0" />
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No exercises found.</p>
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full mt-4 h-12 border-dashed"
                onClick={() => setCustomOpen(true)}
              >
                Create Custom Exercise
              </Button>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <CustomExerciseSheet 
        open={customOpen} 
        onOpenChange={setCustomOpen} 
        onCreated={handleCustomCreated}
      />
    </>
  );
}
