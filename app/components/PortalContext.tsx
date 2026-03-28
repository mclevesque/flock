"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Portal = "ryft" | "greatsouls";

const PortalContext = createContext<{
  portal: Portal;
  setPortal: (p: Portal) => void;
}>({ portal: "ryft", setPortal: () => {} });

export function usePortal() {
  return useContext(PortalContext);
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [portal, setPortalState] = useState<Portal>("ryft");

  useEffect(() => {
    // Read portal from cookie on mount
    const match = document.cookie.match(/(?:^|; )ryft_portal=(\w+)/);
    if (match?.[1] === "greatsouls") setPortalState("greatsouls");
  }, []);

  function setPortal(p: Portal) {
    setPortalState(p);
    document.cookie = `ryft_portal=${p};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    // Apply/remove GS theme class on body
    if (p === "greatsouls") {
      document.body.classList.add("gs-theme");
    } else {
      document.body.classList.remove("gs-theme");
    }
  }

  useEffect(() => {
    if (portal === "greatsouls") {
      document.body.classList.add("gs-theme");
    }
    return () => { document.body.classList.remove("gs-theme"); };
  }, [portal]);

  return (
    <PortalContext.Provider value={{ portal, setPortal }}>
      {children}
    </PortalContext.Provider>
  );
}
