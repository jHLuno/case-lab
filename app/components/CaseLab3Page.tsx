import BackToTop from "./BackToTop";
import CaseLab3HowItWorks from "../sections/CaseLab3HowItWorks";
import CaseLab3Hero from "../sections/CaseLab3Hero";
import CaseLab3FAQ from "../sections/CaseLab3FAQ";
import CaseLab3Proof from "../sections/CaseLab3Proof";
import CaseLab3Speakers from "../sections/CaseLab3Speakers";
import CaseLab3Tickets from "../sections/CaseLab3Tickets";
import Cases from "../sections/Cases";
import CaseLab3Navbar from "./CaseLab3Navbar";
import CaseLab3Footer from "./CaseLab3Footer";

export default function CaseLab3Page() {
  return (
    <div className="relative overflow-x-clip bg-white">
      <CaseLab3Navbar />
      <main id="main" tabIndex={-1}>
        <CaseLab3Hero />
        <CaseLab3Speakers />
        <CaseLab3HowItWorks />
        <CaseLab3Tickets />
        <CaseLab3Proof />
        <Cases alignToCaseLab />
        <CaseLab3FAQ />
      </main>
      <CaseLab3Footer />
      <BackToTop />
    </div>
  );
}
