import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';

// each route is its own chunk: the landing page never loads the workbench, and the reverse
const LandingPage = lazy(() => import('./LandingPage.jsx'));
const Workspace = lazy(() => import('./workspace/Workspace.jsx'));

// Landing-page demo buttons name a scenario; the root-cause one opens the recorded ALT-001 run.
const SCENARIO_RUNS = { rootcause: { alertId: 'ALT-001', mode: 'replay' } };

function getInitialRoute() {
  if (typeof window === 'undefined') return { route: 'landing', autoStart: null };
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const alert = params.get('alert');
  // deep link for demos: /?alert=ALT-001&mode=replay still lands in the workspace
  if (alert) return { route: 'app', autoStart: { alertId: alert, mode: params.get('mode') === 'replay' ? 'replay' : 'live' } };
  if (path === '/app' || path.startsWith('/app/') || hash.startsWith('#app')) {
    return { route: 'app', autoStart: SCENARIO_RUNS[params.get('scenario')] || null };
  }
  return { route: 'landing', autoStart: null };
}

export default function App() {
  const [nav, setNav] = useState(getInitialRoute);

  useEffect(() => {
    const onPop = () => setNav(getInitialRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateTo = useCallback((route, scenarioId = null) => {
    const target = route === 'app' ? (scenarioId ? `/app?scenario=${scenarioId}` : '/app') : '/';
    window.history.pushState({ route }, '', target);
    setNav(route === 'app' ? { route, autoStart: SCENARIO_RUNS[scenarioId] || null } : { route, autoStart: null });
    window.scrollTo({ top: 0 });
  }, []);

  return <Suspense fallback={null}>
    {nav.route === 'app'
      ? <Workspace onBackHome={() => navigateTo('landing')} autoStart={nav.autoStart} />
      : <LandingPage onLaunchDemo={(scenarioId) => navigateTo('app', scenarioId)} />}
  </Suspense>;
}
