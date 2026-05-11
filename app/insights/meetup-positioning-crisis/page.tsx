import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Case Lab Meetup: позиционирование в кризис",
  "Placeholder-страница будущего ивент-материала Case Lab о позиционировании в кризис."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Ивент"
      title="Case Lab Meetup: позиционирование в кризис"
      description="Запись и ключевые выводы сессии с маркетинг-директорами FMCG и SaaS. Полная страница уже в подготовке."
    />
  );
}
