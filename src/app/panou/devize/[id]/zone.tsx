"use client";

import { createContext, useContext } from "react";

/** Zona de prețuri a devizului deschis (cod de județ sau null = național), pentru căutări și prețuri. */
export const ZoneContext = createContext<string | null>(null);
export const useZone = () => useContext(ZoneContext);
