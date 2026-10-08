import { create } from 'zustand';

/** Dev-only ride simulator scenario (needs EXPO_PUBLIC_ALLOW_SIMULATED_RIDE + server VALIDATION_ALLOW_SIMULATED). */
export type SimulatorScenario = 'off' | 'driving' | 'stopped_ev' | 'stopped_idle' | 'walking';

type SimulatorState = {
  scenario: SimulatorScenario;
  setScenario: (scenario: SimulatorScenario) => void;
};

export const useSimulatorStore = create<SimulatorState>((set) => ({
  scenario: 'off',
  setScenario: (scenario) => set({ scenario }),
}));
