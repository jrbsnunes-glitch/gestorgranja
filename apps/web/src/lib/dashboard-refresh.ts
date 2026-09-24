export const DASHBOARD_REFRESH_EVENT = 'gg-dashboard-refresh';

export function dispatchDashboardRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
  }
}
