import styles from "./ProgressBar.module.css";

type ProgressBarProps = {
  /** Paso actual 1–5. */
  step: number;
};

/** Barra continua: 20 / 40 / 60 / 80 / 100 % según el paso. */
export function ProgressBar({ step }: ProgressBarProps) {
  const clamped = Math.min(5, Math.max(1, step));
  const percent = clamped * 20;

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={clamped}
      aria-label={`Progreso del formulario: paso ${clamped} de 5`}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  );
}
