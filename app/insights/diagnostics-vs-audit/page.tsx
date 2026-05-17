import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Диагностика vs аудит: в чём разница и зачем оба",
  "Зачем проводить диагностику, если уже есть аудит от прошлого агентства."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Экспертиза"
      title="Диагностика vs аудит: в чём разница и зачем оба"
      description="Зачем проводить диагностику, если уже есть аудит от прошлого агентства."
    />
  );
}
