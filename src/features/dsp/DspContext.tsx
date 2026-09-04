import { createContext, useContext, type ReactNode } from "react";
import { useDspController } from "./useDspController";

export type DspController = ReturnType<typeof useDspController>;

const DspContext = createContext<DspController | null>(null);

export function DspProvider({ children }: { children: ReactNode }) {
  const dsp = useDspController();
  return <DspContext.Provider value={dsp}>{children}</DspContext.Provider>;
}

export function useDsp(): DspController {
  const ctx = useContext(DspContext);
  if (!ctx) {
    throw new Error("useDsp debe ser utilizado dentro de un DspProvider");
  }
  return ctx;
}
