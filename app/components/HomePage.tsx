"use client";

import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import LeadPopup from "./LeadPopup";
import { LeadPopupProvider } from "../lib/LeadPopupContext";
import Hero from "../sections/Hero";
import About from "../sections/About";
import Pricing from "../sections/Pricing";
import OurAdvantage from "../sections/OurAdvantage";
import Timeline from "../sections/Timeline";
import Testimonials from "../sections/Testimonials";
import BusinessModel from "../sections/BusinessModel";
import Clients from "../sections/Clients";
import Evolution from "../sections/Evolution";
import QuickLinks from "../sections/QuickLinks";

export default function HomePage() {
  return (
    <LeadPopupProvider>
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
        <LeadPopup />
      </main>
    </LeadPopupProvider>
  );
}
