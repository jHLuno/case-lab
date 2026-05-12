"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import Hero from "../sections/Hero";
import About from "../sections/About";
import Pricing from "../sections/Pricing";
import OurAdvantage from "../sections/OurAdvantage";
import Timeline from "../sections/Timeline";
import Evolution from "../sections/Evolution";

const Testimonials = dynamic(() => import("../sections/Testimonials"), { ssr: false });
const BusinessModel = dynamic(() => import("../sections/BusinessModel"), { ssr: false });
const Clients = dynamic(() => import("../sections/Clients"));
const QuickLinks = dynamic(() => import("../sections/QuickLinks"));

gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  useEffect(() => {
    // Initial refresh after hydration
    ScrollTrigger.refresh();

    // Re-run refresh after dynamic components mount (lazy-loaded sections)
    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 800);

    const handleResize = () => {
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", handleResize);

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (href && href !== "#") {
          e.preventDefault();
          const element = document.querySelector(href);
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener("resize", handleResize);
      clearTimeout(refreshTimer);
    };
  }, []);

  return (
    <main className="relative">
      <Navbar />
      <Hero />
      <About />
      <Pricing />
      <OurAdvantage />
      <Timeline />
      <Testimonials />
      <BusinessModel />
      <Clients />
      <Evolution />
      <QuickLinks />
      <Footer />
      <BackToTop />
    </main>
  );
}
