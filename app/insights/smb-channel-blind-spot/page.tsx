import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Почему 70% СМБ теряют деньги на одном и том же канале",
  "Типичная слепая зона в маркетинге среднего бизнеса."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Наблюдение"
      title="Почему 70% СМБ теряют деньги на одном и том же канале"
      description="Типичная слепая зона в маркетинге среднего бизнеса."
    />
  );
}
