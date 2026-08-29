"use client";

import { useEffect } from "react";
import Navbar from "./Navbar";

const caseLab3NavLinks = [
  { label: "Кейсы", href: "#cases" },
  { label: "Спикеры", href: "#case-lab-3-speakers" },
  { label: "Отзывы", href: "#case-lab-3-proof" },
  { label: "Билеты", href: "#tickets" },
  { label: "Вопросы", href: "#faq" },
];

export default function CaseLab3Navbar() {
  useEffect(() => {
    document.documentElement.classList.add("caseLabPage");
    document.body.classList.add("caseLabForceMotion");
    document.body.classList.add("caseLabPage");

    return () => {
      document.documentElement.classList.remove("caseLabPage");
      document.body.classList.remove("caseLabForceMotion");
      document.body.classList.remove("caseLabPage");
    };
  }, []);

  return (
    <Navbar
      accent="blue"
      logoSrc="/Logo.png"
      navLinks={caseLab3NavLinks}
      basePath="/case-lab-3/"
      ctaLabel="Купить билет"
      ctaHref={null}
      hideOnScroll
      forceMotion
      menuDescription="Событие для маркетологов и команд, которым важны реальные решения."
    />
  );
}
