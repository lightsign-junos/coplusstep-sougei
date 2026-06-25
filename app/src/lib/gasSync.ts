import { useDataStore } from '../store/dataStore';
import { gasSaveAll } from './gasClient';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function setupGasSync() {
  useDataStore.subscribe((state, prev) => {
    // Only auto-save after initial GAS load is complete
    if (!state.gasLoaded) return;

    const changed =
      state.members !== prev.members ||
      state.memberLocations !== prev.memberLocations ||
      state.staff !== prev.staff ||
      state.vehicles !== prev.vehicles ||
      state.routes !== prev.routes ||
      state.routeStops !== prev.routeStops ||
      state.dailyOverrides !== prev.dailyOverrides ||
      state.allowedUsers !== prev.allowedUsers;

    if (!changed) return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      gasSaveAll({
        members: state.members,
        memberLocations: state.memberLocations,
        staff: state.staff,
        vehicles: state.vehicles,
        routes: state.routes,
        routeStops: state.routeStops,
        dailyOverrides: state.dailyOverrides,
        allowedUsers: state.allowedUsers,
      });
    }, 2000);
  });
}
