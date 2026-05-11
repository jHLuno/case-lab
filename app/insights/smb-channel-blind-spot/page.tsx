import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Почему 70% SMB теряют деньги на одном и том же канале",
  "Placeholder-страница будущего наблюдения Case Lab про типичную слепую зону SMB."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Наблюдение"
      title="Почему 70% SMB теряют деньги на одном и том же канале"
      description="Типичная слепая зона среднего бизнеса: один и тот же канал съедает бюджет, но почти не даёт роста. Скоро опубликуем полный материал."
    />
  );
}
