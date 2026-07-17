"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type LeadSource = "main" | "evp-pro";

type LeadPopupContextType = {
  isOpen: boolean;
  source: LeadSource;
  openPopup: () => void;
  closePopup: () => void;
};

const LeadPopupContext = createContext<LeadPopupContextType | null>(null);

const noop = () => {};

export function useLeadPopup() {
  const ctx = useContext(LeadPopupContext);
  if (!ctx) return { isOpen: false, source: "main", openPopup: noop, closePopup: noop } as LeadPopupContextType;
  return ctx;
}

export function LeadPopupProvider({
  children,
  source = "main",
}: {
  children: ReactNode;
  source?: LeadSource;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const openPopup = useCallback(() => setIsOpen(true), []);
  const closePopup = useCallback(() => setIsOpen(false), []);

  return (
    <LeadPopupContext.Provider value={{ isOpen, source, openPopup, closePopup }}>
      {children}
    </LeadPopupContext.Provider>
  );
}
