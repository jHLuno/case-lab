"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type LeadPopupContextType = {
  isOpen: boolean;
  openPopup: () => void;
  closePopup: () => void;
};

const LeadPopupContext = createContext<LeadPopupContextType | null>(null);

const noop = () => {};

export function useLeadPopup() {
  const ctx = useContext(LeadPopupContext);
  if (!ctx) return { isOpen: false, openPopup: noop, closePopup: noop } as LeadPopupContextType;
  return ctx;
}

export function LeadPopupProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openPopup = useCallback(() => setIsOpen(true), []);
  const closePopup = useCallback(() => setIsOpen(false), []);

  return (
    <LeadPopupContext.Provider value={{ isOpen, openPopup, closePopup }}>
      {children}
    </LeadPopupContext.Provider>
  );
}
