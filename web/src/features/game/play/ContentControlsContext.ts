import { createContext, type ReactNode } from "react";

/** Presentation controls are shared with nested media and legacy question bodies. */
export const ContentControlsContext = createContext<ReactNode | undefined>(undefined);
