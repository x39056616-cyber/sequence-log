import { create } from "zustand";
import type { QuestCompletion } from "@/lib/types";

interface UIState {
  navOpen: boolean;
  completion: QuestCompletion | null;
  setNavOpen: (open: boolean) => void;
  showCompletion: (completion: QuestCompletion) => void;
  closeCompletion: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  navOpen: false,
  completion: null,
  setNavOpen: (navOpen) => set({ navOpen }),
  showCompletion: (completion) => set({ completion }),
  closeCompletion: () => set({ completion: null }),
}));
