import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Как inDrive выстроил локальный бренд в Казахстане",
  "Placeholder-страница будущего разбора кейса inDrive от Case Lab."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Поток #2"
      title="Как inDrive выстроил локальный бренд в Казахстане"
      description="Разбор кейса: от стратегии до метрик. Что сработало, почему это дало результат и какие выводы можно забрать себе."
    />
  );
}
