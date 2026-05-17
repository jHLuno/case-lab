import ComingSoonPage, { buildComingSoonMetadata } from "../../components/ComingSoonPage";

export const metadata = buildComingSoonMetadata(
  "Коллаборации, селебрити, импакт — три кейса с NBS",
  "Как abr превратила коллаборации в трафик, inDrive выбирает амбассадоров по данным, а BLVD дошёл до Cannes Lions."
);

export default function Page() {
  return (
    <ComingSoonPage
      tag="Поток #2"
      title="Коллаборации, селебрити, импакт — три кейса с NBS"
      description="Как abr превратила коллаборации в трафик, inDrive выбирает амбассадоров по данным, а BLVD дошёл до Cannes Lions."
    />
  );
}
