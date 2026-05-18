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

const ClientsPain = dynamic(() => import("../sections/ClientsPain"), { ssr: false });
const Timeline = dynamic(() => import("../sections/Timeline"), { ssr: false });
const Testimonials = dynamic(() => import("../sections/Testimonials"), { ssr: false });
const BeforeAfter = dynamic(() => import("../sections/BeforeAfter"), { ssr: false });
const Team = dynamic(() => import("../sections/Team"), { ssr: false });
const Cases = dynamic(() => import("../sections/Cases"), { ssr: false });
const Evolution = dynamic(() => import("../sections/Evolution"), { ssr: false });
const News = dynamic(() => import("../sections/News"), { ssr: false });

export default function HomePage() {
  return (
    <LeadPopupProvider>
      <div className="relative">
        <Navbar />
        <Hero />
        <ClientsPain />
        <Pricing />
        <BeforeAfter />
        <Timeline />
        <Testimonials />
        <Team />
        <About />
        <Cases />
        <Evolution />
        <News />
        <Footer />
        <BackToTop />
        <LeadPopup />
      </div>
    </LeadPopupProvider>
  );
}
