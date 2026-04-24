import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CRMLayout from "./components/CRMLayout";
import Overview from "./pages/Overview";
import Pipeline from "./pages/Pipeline";
import Contacts from "./pages/Contacts";
import Deals from "./pages/Deals";
import Team from "./pages/Team";
import Reports from "./pages/Reports";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <CRMLayout><Overview /></CRMLayout>} />
      <Route path="/pipeline" component={() => <CRMLayout><Pipeline /></CRMLayout>} />
      <Route path="/contacts" component={() => <CRMLayout><Contacts /></CRMLayout>} />
      <Route path="/deals" component={() => <CRMLayout><Deals /></CRMLayout>} />
      <Route path="/team" component={() => <CRMLayout><Team /></CRMLayout>} />
      <Route path="/reports" component={() => <CRMLayout><Reports /></CRMLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
