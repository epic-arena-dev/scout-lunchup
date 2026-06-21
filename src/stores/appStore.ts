import { create } from 'zustand'

interface Industry { code: string; name: string }

interface ThemeColors {
  primary: string
  copper: string
  copperLight: string
  copperDark: string
  warmBg: string
  warmBgAlt: string
  warmText: string
  warmMuted: string
}

interface ThemeConfig {
  id: string
  name: string
  colors: ThemeColors
  is_active: boolean
}

interface AppState {
  globalLoading: boolean
  industries: Industry[]
  currentIndustry: Industry
  theme: ThemeConfig | null
  setGlobalLoading: (v: boolean) => void
  setIndustry: (industry: Industry) => void
  setTheme: (t: ThemeConfig) => void
}

export const useAppStore = create<AppState>((set) => ({
  globalLoading: false,
  industries: [{ code: 'hvac', name: '暖通空调' }],
  currentIndustry: { code: 'hvac', name: '暖通空调' },
  theme: null,
  setGlobalLoading: (v) => set({ globalLoading: v }),
  setIndustry: (industry) => set({ currentIndustry: industry }),
  setTheme: (t) => set({ theme: t }),
}))
