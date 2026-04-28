import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import { Home } from "@/pages/Home";
import { WorkoutScreen } from "@/pages/Workout";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-md mx-auto bg-background shadow-2xl overflow-hidden relative">
      <AppHeader />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/workout" component={WorkoutScreen} />
        <Route path="/history" component={History} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster theme="dark" position="top-center" />
        <ShadcnToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
