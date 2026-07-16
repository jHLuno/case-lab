const PETAL_COUNT = 24;
const CENTER = 255;
const TIP_RADIUS = 232;
const PETAL_WIDTH = 15;
const petals = Array.from({ length: PETAL_COUNT }, (_, index) => (360 / PETAL_COUNT) * index);

export default function EVPStarburst({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 510 510" fill="currentColor" className={className}>
      {petals.map((angle) => (
        <path
          key={angle}
          transform={`rotate(${angle} ${CENTER} ${CENTER})`}
          d={`M ${CENTER} ${CENTER} Q ${CENTER - PETAL_WIDTH} ${CENTER - TIP_RADIUS * 0.55} ${CENTER} ${CENTER - TIP_RADIUS} Q ${CENTER + PETAL_WIDTH} ${CENTER - TIP_RADIUS * 0.55} ${CENTER} ${CENTER} Z`}
        />
      ))}
    </svg>
  );
}
