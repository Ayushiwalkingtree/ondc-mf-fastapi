import clsx from 'clsx';
import { useStepNavigation } from '../../hooks/useStepNavigation';
import styles from './Sidebar.module.scss';

const Sidebar = () => {
  const { activeStep, goToStep, steps } = useStepNavigation();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>MF</div>
        <div>
          <h1 className={styles.brandTitle}>ONDC Buyer App</h1>
          <p className={styles.brandSubtitle}>Mutual Fund Transaction Demo</p>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Buyer journey steps">
        {steps.map((step) => (
          <button
            type="button"
            key={step.path}
            className={clsx(styles.stepButton, activeStep.index === step.index && styles.active)}
            onClick={() => goToStep(step.index)}
          >
            <span className={styles.stepNo}>{step.index + 1}</span>
            <span className={styles.stepLabel}>{step.navLabel}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
