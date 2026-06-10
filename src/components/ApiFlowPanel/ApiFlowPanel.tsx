import styles from './ApiFlowPanel.module.scss';

const flow = [
  ['/search', 'discover MF schemes'],
  ['/on_search', 'receive catalogue'],
  ['/select', 'select scheme/quote'],
  ['/init', 'investor + payment init'],
  ['/confirm', 'place order'],
  ['/status', 'track order'],
] as const;

const ApiFlowPanel = () => (
  <div className={styles.flow}>
    {flow.map(([endpoint, label]) => (
      <div className={styles.api} key={endpoint}>
        <strong>{endpoint}</strong> {label}
      </div>
    ))}
  </div>
);

export default ApiFlowPanel;
