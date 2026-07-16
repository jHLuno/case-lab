"use client";

import { useEffect, useRef } from "react";
import EVPProNavbar from "./EVPProNavbar";
import EVPProMinimalFooter from "./EVPProMinimalFooter";
import BackToTop from "./BackToTop";
import LeadPopup from "./LeadPopup";
import { LeadPopupProvider } from "../lib/LeadPopupContext";
import EVPProHero from "../sections/EVPProHero";
import EVPExplained from "../sections/EVPExplained";
import EVPAlignment from "../sections/EVPAlignment";
import EVPProSession from "../sections/EVPProSession";
import EVPProAudience from "../sections/EVPProAudience";
import EVPProFacilitators from "../sections/EVPProFacilitators";
import EVPProProof from "../sections/EVPProProof";
import EVPProPricing from "../sections/EVPProPricing";
import EVPProFAQ from "../sections/EVPProFAQ";
import EVPProClosing from "../sections/EVPProClosing";

export default function EVPProPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const page = pageRef.current;
    if (!page) return;

    document.documentElement.classList.add("evp-motion-ready");
    const elements = Array.from(page.querySelectorAll<HTMLElement>("[data-evp-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          element.classList.add("is-revealed");
          observer.unobserve(element);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8%" }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("evp-motion-ready");
    };
  }, []);

  return (
    <LeadPopupProvider>
      <div ref={pageRef} className="relative">
        <EVPProNavbar />
        <EVPProHero />
        <EVPExplained />
        <EVPAlignment />
        <EVPProSession />
        <EVPProAudience />
        <EVPProFacilitators />
        <EVPProPricing />
        <EVPProProof />
        <EVPProFAQ />
        <EVPProClosing />
        <EVPProMinimalFooter />
        <BackToTop />
        <LeadPopup />
      </div>
    </LeadPopupProvider>
  );
}
