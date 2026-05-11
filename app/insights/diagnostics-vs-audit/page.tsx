import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Диагностика vs аудит",
  "Placeholder-страница будущего материала Case Lab о разнице между диагностикой и аудитом."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Экспертиза"
      title="Диагностика vs аудит: в чём разница и зачем оба"
      description="Скоро здесь будет материал о том, зачем проводить диагностику, если у вас уже был аудит от прошлого агентства, и в чём принципиальная разница подходов."
    />
  );
}
