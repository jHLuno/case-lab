import BackToTop from "./BackToTop";
import CaseLab3HowItWorks from "../sections/CaseLab3HowItWorks";
import CaseLab3Hero from "../sections/CaseLab3Hero";
import CaseLab3FAQ from "../sections/CaseLab3FAQ";
import CaseLab3Proof from "../sections/CaseLab3Proof";
import CaseLab3Speakers from "../sections/CaseLab3Speakers";
import CaseLab3Tickets from "../sections/CaseLab3Tickets";
import Cases from "../sections/Cases";
import CaseLab3Navbar from "./CaseLab3Navbar";
import Footer from "./Footer";
import { caseLab3CheckoutHref } from "../lib/caseLab3";

export default function CaseLab3Page() {
  return (
    <div className="relative overflow-x-clip bg-white">
      <CaseLab3Navbar />
      <CaseLab3Hero />
      <CaseLab3Speakers />
      <CaseLab3HowItWorks />
      <CaseLab3Proof />
      <Cases alignToCaseLab />
      <CaseLab3Tickets />
      <CaseLab3FAQ />
      <Footer
        accent="blue"
        ctaHeading="Увидимся на Case Lab 3"
        ctaDescription="Первые 20 билетов стоят 7 890 ₸. Дальше цена будет 15 000 ₸."
        ctaLabel="Купить билет"
        ctaHref={caseLab3CheckoutHref}
      />
      <BackToTop />
    </div>
  );
}
