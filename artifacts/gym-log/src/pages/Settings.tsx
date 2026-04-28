import { useState, useEffect } from "react";
import { Settings as SettingsType } from "@/lib/types";
import { storage } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";

export function Settings() {
  const [settings, setSettings] = useState<SettingsType>(storage.getSettings());

  const updateSetting = (key: keyof SettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    storage.saveSettings(newSettings);
    toast.success("Settings updated");
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to delete ALL your workout history, custom exercises, and settings? This cannot be undone.")) {
      storage.clearAll();
      setSettings(storage.getSettings());
      toast.success("All data cleared");
    }
  };

  const handleExport = () => {
    const data = {
      exercises: storage.getExercises(),
      workouts: storage.getWorkouts(),
      history: storage.getHistory(),
      settings: storage.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gymlog-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 px-4 py-6 pb-24 overflow-y-auto space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Weight Unit</Label>
              <p className="text-sm text-muted-foreground">Used for new workouts</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${settings.unit === 'kg' ? 'font-bold' : 'text-muted-foreground'}`}>kg</span>
              <Switch 
                checked={settings.unit === "lb"}
                onCheckedChange={(checked) => updateSetting("unit", checked ? "lb" : "kg")}
              />
              <span className={`text-sm ${settings.unit === 'lb' ? 'font-bold' : 'text-muted-foreground'}`}>lb</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Default Rest Timer</Label>
              <p className="text-sm text-muted-foreground">Countdown duration</p>
            </div>
            <Select 
              value={settings.defaultRest.toString()} 
              onValueChange={(v) => updateSetting("defaultRest", parseInt(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">60s</SelectItem>
                <SelectItem value="90">90s</SelectItem>
                <SelectItem value="120">120s</SelectItem>
                <SelectItem value="180">180s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Data Management</h3>
        <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={handleExport}>
          <Download className="w-5 h-5 text-muted-foreground" />
          Export Data Backup
        </Button>
        <Button variant="destructive" className="w-full justify-start gap-3 h-12" onClick={handleClearData}>
          <Trash2 className="w-5 h-5" />
          Clear All Data
        </Button>
      </div>
    </div>
  );
}
