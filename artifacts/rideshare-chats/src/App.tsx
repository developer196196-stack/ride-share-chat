import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MobileFrame } from '@/components/layout/MobileFrame';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import Onboarding from '@/pages/onboarding';
import OnboardingSecond from '@/pages/onboarding-second';
import Rules from '@/pages/rules';
import Auth from '@/pages/auth';
import Profile from '@/pages/profile';
import Connect from '@/pages/connect';
import Permissions from '@/pages/permissions';
import Validation from '@/pages/validation';
import Vibe from '@/pages/vibe';
import Room from '@/pages/room';
import Report from '@/pages/report';
import Summary from '@/pages/summary';
import Grace from '@/pages/grace';
import Match from '@/pages/match';
import History from '@/pages/history';
import SettingsScreen from '@/pages/settings';

const queryClient = new QueryClient();

function Router() {
  return (
    <MobileFrame>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Onboarding} />
          <Route path="/onboarding2" component={OnboardingSecond} />
          <Route path="/rules" component={Rules} />
          <Route path="/auth" component={Auth} />
          <Route path="/profile" component={Profile} />
          <Route path="/connect" component={Connect} />
          <Route path="/permissions" component={Permissions} />
          <Route path="/validation" component={Validation} />
          <Route path="/vibe" component={Vibe} />
          <Route path="/room" component={Room} />
          <Route path="/report" component={Report} />
          <Route path="/summary" component={Summary} />
          <Route path="/grace" component={Grace} />
          <Route path="/match" component={Match} />
          <Route path="/history" component={History} />
          <Route path="/settings" component={SettingsScreen} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </MobileFrame>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
