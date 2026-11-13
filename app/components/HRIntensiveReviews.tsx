// Reviews: a slowly drifting row of tilted cards (marquee). Companies are not named,
// so each card shows the author's role, industry and the session format instead.
// TODO(content): replace the placeholder reviews below with real ones.
type Review = {
  initials: string;
  author: string; // name if the person agreed, otherwise only the role
  role: string; // role, industry, company size
  quote: string;
  tag: string; // format or result of the session
};

const reviews: Review[] = [
  {
    initials: "HR",
    author: "HR-директор",
    role: "FMCG, 1 500+ сотрудников",
    quote: "Текст отзыва: что изменилось в команде после сессии и что стало понятнее про молодых кандидатов и клиентов.",
    tag: "Целый день",
  },
  {
    initials: "КД",
    author: "Коммерческий директор",
    role: "Дистрибуция, 300+ сотрудников",
    quote: "Текст отзыва: какой инсайт про молодых клиентов команда продаж забрала в работу.",
    tag: "Полдня",
  },
  {
    initials: "CMO",
    author: "Директор по маркетингу",
    role: "Ритейл, 800+ сотрудников",
    quote: "Текст отзыва: что поменяли в коммуникации бренда после блока о зумерах.",
    tag: "3 часа",
  },
  {
    initials: "CEO",
    author: "Генеральный директор",
    role: "Финансовые услуги, 2 000+ сотрудников",
    quote: "Текст отзыва: зачем руководству было важно пройти интенсив вместе с командой.",
    tag: "Целый день",
  },
  {
    initials: "HR",
    author: "Руководитель по найму",
    role: "IT, 150+ сотрудников",
    quote: "Текст отзыва: что изменилось в найме молодых специалистов после разбора EJM.",
    tag: "Полдня",
  },
];

const TILTS = [-4, 3, -2.5, 4, -3];
const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

function ReviewCard({ review, tilt }: { review: Review; tilt: number }) {
  return (
    <figure
      className="hr-review-card flex w-[300px] shrink-0 flex-col rounded-[20px] border border-white bg-[#eef0fb] p-6 shadow-[0_24px_50px_-28px_rgba(4,0,130,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:w-[340px]"
      style={{ rotate: `${tilt}deg` }}
    >
      <figcaption className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full bg-[#040082] text-[12px] font-bold text-white"
          style={headingFont}
        >
          {review.initials}
        </span>
        <span className="min-w-0" style={bodyFont}>
          <span className="block text-[15px] font-medium text-black">{review.author}</span>
          <span className="block text-[12px] text-black/50">{review.role}</span>
        </span>
      </figcaption>
      <blockquote className="mt-5 flex-1 text-[15px] leading-[1.5] text-black/75" style={bodyFont}>
        <span aria-hidden="true" className="mr-1 text-[#040082]">
          «
        </span>
        {review.quote}
        <span aria-hidden="true" className="ml-0.5 text-[#040082]">
          »
        </span>
      </blockquote>
      <p className="mt-5 text-[11px] uppercase tracking-[0.1em] text-[#040082]/70" style={bodyFont}>
        Формат: {review.tag}
      </p>
    </figure>
  );
}

export default function HRIntensiveReviews() {
  return (
    <section
      aria-labelledby="hr-reviews-title"
      className="overflow-hidden bg-white py-[48px] md:py-14 lg:py-16"
    >
      <div className="mx-auto max-w-[1160px] px-6 md:px-10 xl:px-0">
        <span className="mb-3 block text-[11px] uppercase leading-[1.58] tracking-wider text-[#040082]" style={bodyFont}>
          Отзывы
        </span>
        <h2
          id="hr-reviews-title"
          className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
          style={headingFont}
        >
          Что говорят участники
        </h2>
        <p className="mt-5 max-w-[640px] text-[15px] leading-[1.55] text-black/60 lg:text-[17px]" style={bodyFont}>
          Названия компаний не раскрываем: указываем роль автора, отрасль и формат сессии.
        </p>
      </div>

      {/* Drifting row: the list is rendered twice for a seamless loop; the copy is hidden from screen readers. */}
      <div className="hr-reviews-viewport mt-[32px] overflow-x-auto py-6 md:mt-[40px] md:overflow-hidden">
        <div className="hr-reviews-track flex w-max px-6 md:px-0">
          <ul className="flex gap-5 md:pr-5">
            {reviews.map((review, i) => (
              <li key={i}>
                <ReviewCard review={review} tilt={TILTS[i % TILTS.length]} />
              </li>
            ))}
          </ul>
          <ul className="hr-reviews-copy flex gap-5 pr-5" aria-hidden="true">
            {reviews.map((review, i) => (
              <li key={i}>
                <ReviewCard review={review} tilt={TILTS[i % TILTS.length]} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
