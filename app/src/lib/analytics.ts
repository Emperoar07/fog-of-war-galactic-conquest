const ANALYTICS_KEY = "fog-of-war-analytics";

interface AnalyticsStore {
  demoStarts: number;
  turnsPlayed: number;
  tutorialCompleted: number;
  matchesViewed: number;
  visibilityRequests: number;
  ordersSubmitted: number;
}

function getStore(): AnalyticsStore {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (raw) return JSON.parse(raw) as AnalyticsStore;
  } catch {
    // ignore
  }
  return {
    demoStarts: 0,
    turnsPlayed: 0,
    tutorialCompleted: 0,
    matchesViewed: 0,
    visibilityRequests: 0,
    ordersSubmitted: 0,
  };
}

function save(store: AnalyticsStore) {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function trackEvent(event: keyof AnalyticsStore) {
  const store = getStore();
  store[event] += 1;
  save(store);
}

export function getAnalytics(): AnalyticsStore {
  return getStore();
}
