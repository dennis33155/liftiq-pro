import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Category, MuscleGroup, Exercise } from "@/lib/types";
import { storage } from "@/lib/storage";

interface CustomExerciseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

const CATEGORIES: Category[] = ["Chest", "Back", "Legs", "Arms", "Shoulders", "Full Body"];

export function CustomExerciseSheet({ open, onOpenChange, onCreated }: CustomExerciseSheetProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Full Body");

  const handleSave = () => {
    if (!name.trim()) return;

    const newEx: Exercise = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      primaryMuscle: category === "Full Body" ? "Full Body" : category,
      secondaryMuscles: [],
      category,
      isCustom: true
    };

    const exercises = storage.getExercises();
    storage.saveExercises([...exercises, newEx]);
    
    setName("");
    setCategory("Full Body");
    onCreated(newEx.id);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Create Custom Exercise</DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Exercise Name</Label>
            <Input 
              id="name" 
              placeholder="e.g. Weighted Pull-ups" 
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(val: Category) => setCategory(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DrawerFooter>
          <Button onClick={handleSave} disabled={!name.trim()} className="h-12 text-lg">Save Exercise</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
