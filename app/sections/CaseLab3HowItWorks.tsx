import styles from "../case-lab-3/case-lab-3.module.css";

const steps = [
  {
    title: "Спикер приносит свой кейс",
    body: "Спикер показывает контекст: с чего всё началось, какая была проблема и какие ограничения стояли перед командой.",
  },
  {
    title: "Зал предлагает решения",
    body: "Ход переходит аудитории: участники предлагают свои решения и пытаются угадать, что команда сделала на самом деле.",
  },
  {
    title: "Спикер раскрывает все детали",
    body: "После обсуждения спикер показывает, какие решения приняли, что сработало, где ошиблись и к какому результату пришли.",
  },
  {
    title: "Правильные ответы = баллы",
    body: "За точные ответы участники получают баллы. Они идут в таблицу лидеров, которая обновляется по ходу мероприятия.",
  },
  {
    title: "В финале определяем топ-3",
    body: "В финале определим топ-3 участников Case\u00a0Lab\u00a0III. Те, кто лучше всех разбирался в кейсах и чаще попадал в реальные решения команд, получат призы.",
  },
] as const;

export default function CaseLab3HowItWorks() {
  return (
    <section
      id="case-lab-3-how-it-works"
      className={styles.howItWorksSection}
      aria-labelledby="case-lab-3-how-it-works-title"
    >
      <div className={styles.howItWorksLayout}>
        <div className={styles.howItWorksIntro}>
          <h2 id="case-lab-3-how-it-works-title">
            <span>Как проходит</span>
            <span>Case Lab</span>
          </h2>
          <p className={styles.howItWorksOutcome}>
            Каждый спикер приносит свой кейс и разбирает его вместе с залом.
          </p>
          <div className={styles.howItWorksScoreboard}>
            <strong>ТОП-3</strong>
            <span>
              участники Case&nbsp;Lab&nbsp;III
              <br />
              получат призы
            </span>
          </div>
        </div>

        <ol className={styles.howItWorksSteps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.howItWorksStep}>
              <span className={styles.howItWorksStepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
