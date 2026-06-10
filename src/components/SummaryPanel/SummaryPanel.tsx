import { Card, CardContent } from '@mui/material';
import ApiFlowPanel from '../ApiFlowPanel/ApiFlowPanel';
import { journeySteps } from '../../routes/steps';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import styles from './SummaryPanel.module.scss';

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.kv}>
    <span className={styles.label}>{label}</span>
    <strong className={styles.value}>{value}</strong>
  </div>
);

const SummaryPanel = () => {
  const currentStep = useMfJourneyStore((state) => state.currentStep);
  const selectedScheme = useMfJourneyStore((state) => state.selectedScheme);

  return (
    <aside className={styles.summary}>
      <Card className={styles.card}>
        <CardContent>
          <h3 className={styles.title}>Journey Summary</h3>
          <SummaryRow label="Buyer Role" value="Investor App" />
          <SummaryRow label="Network" value="ONDC" />
          <SummaryRow label="Product" value="Mutual Funds" />
          <SummaryRow label="Current Step" value={journeySteps[currentStep]?.navLabel ?? 'Onboarding'} />
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardContent>
          <h3 className={styles.title}>ONDC API Flow</h3>
          <ApiFlowPanel />
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardContent>
          <h3 className={styles.title}>Selected Scheme</h3>
          <SummaryRow label="Name" value={selectedScheme?.name ?? 'Not selected'} />
          <SummaryRow label="Provider" value={selectedScheme?.providerName ?? '-'} />
          <SummaryRow label="Category" value={selectedScheme?.categoryPath ?? '-'} />
          <SummaryRow label="ISIN" value={selectedScheme?.identifiers.isin ?? '-'} />
        </CardContent>
      </Card>
    </aside>
  );
};

export default SummaryPanel;
