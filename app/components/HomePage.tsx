"use client";

import dynamic from "next/dynamic";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import LeadPopup from "./LeadPopup";
import { LeadPopupProvider } from "../lib/LeadPopupContext";
import Hero from "../sections/Hero";
import About from "../sections/About";
import Pricing from "../sections/Pricing";

const OurAdvantage = dynamic(() => import("../sections/OurAdvantage"), { ssr: false });
const Timeline = dynamic(() => import("../sections/Timeline"), { ssr: false });
const Testimonials = dynamic(() => import("../sections/Testimonials"), { ssr: false });
const BusinessModel = dynamic(() => import("../sections/BusinessModel"), { ssr: false });
const Clients = dynamic(() => import("../sections/Clients"), { ssr: false });
const Evolution = dynamic(() => import("../sections/Evolution"), { ssr: false });
const QuickLinks = dynamic(() => import("../sections/QuickLinks"), { ssr: false });

export default function HomePage() {
  return (
    <LeadPopupProvider>
      <main className="relative">
        <Navbar />
        <Hero />
        <BusinessModel />
        <Pricing />
        <OurAdvantage />
        <About />
        <Timeline />
        <Testimonials />
        <Clients />
        <Evolution />
        <QuickLinks />
        <Footer />
        <BackToTop />
        <LeadPopup />
      </main>
    </LeadPopupProvider>
  );
}
