import Navbar from "./Navbar";

const evpProNavLinks = [
  { label: "Формат", href: "#session" },
  { label: "Фасилитаторы", href: "#facilitators" },
  { label: "Стоимость", href: "#pricing" },
  { label: "Вопросы", href: "#faq" },
];

export default function EVPProNavbar() {
  return (
    <Navbar
      accent="emerald"
      logoSrc="/logo green black.png"
      navLinks={evpProNavLinks}
      basePath="/evp-pro/"
      ctaLabel="Забронировать место"
    />
  );
}
