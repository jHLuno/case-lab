import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Первый поток: 3 кейса, которые повлияли на рынок",
  "Shetel, ZimaBlue, Hero's Journey — системный разбор проектов, которые повлияли на бизнес и индустрию."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Поток #1"
      title="Первый поток: 3 кейса, которые повлияли на рынок"
      description="Shetel, ZimaBlue, Hero's Journey — системный разбор проектов, которые повлияли на бизнес и индустрию."
    />
  );
}
