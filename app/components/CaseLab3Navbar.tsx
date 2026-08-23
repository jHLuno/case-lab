import Navbar from "./Navbar";
import { caseLab3CheckoutHref } from "../lib/caseLab3";

const caseLab3NavLinks = [
  { label: "Кейсы", href: "#cases" },
  { label: "Спикеры", href: "#case-lab-3-speakers" },
  { label: "Отзывы", href: "#case-lab-3-proof" },
  { label: "Билеты", href: "#tickets" },
  { label: "Вопросы", href: "#faq" },
];

export default function CaseLab3Navbar() {
  return (
    <Navbar
      accent="blue"
      logoSrc="/Logo.png"
      navLinks={caseLab3NavLinks}
      basePath="/case-lab-3/"
      ctaLabel="Купить билет"
      ctaHref={caseLab3CheckoutHref}
      hideOnScroll
      menuDescription="Событие для маркетологов и команд, которым важны реальные решения."
    />
  );
}
