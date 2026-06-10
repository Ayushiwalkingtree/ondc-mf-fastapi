import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Button, Card, CardContent } from '@mui/material';
import type { ParsedScheme, ThresholdValue } from '../../types/scheme';
import styles from './SchemeCard.module.scss';

interface SchemeCardProps {
  scheme: ParsedScheme;
  onSelect: (scheme: ParsedScheme) => void;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_');

const findThreshold = (thresholds: ThresholdValue[], patterns: string[]): string | undefined => {
  const normalizedPatterns = patterns.map(normalize);
  return thresholds.find((threshold) => {
    const haystack = normalize(`${threshold.source} ${threshold.label}`);
    return normalizedPatterns.some((pattern) => haystack.includes(pattern));
  })?.value;
};

const ValueRow = ({ label, value }: { label: string; value?: string }) => (
  <div className={styles.valueRow}>
    <span>{label}</span>
    <strong>{value || '-'}</strong>
  </div>
);

const SchemeCard = ({ scheme, onSelect }: SchemeCardProps) => {
  const minimumAmount = findThreshold(scheme.thresholds, [
    'amount_min',
    'min_amount',
    'minimum_amount',
    'amount_minimum',
  ]);
  const maximumAmount = findThreshold(scheme.thresholds, [
    'amount_max',
    'max_amount',
    'maximum_amount',
    'amount_maximum',
  ]);

  return (
    <Card className={styles.card}>
      <CardContent className={styles.content}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{scheme.amcName || scheme.providerName}</p>
            <h3 className={styles.title}>{scheme.name}</h3>
            <p className={styles.category}>{scheme.categoryPath || '-'}</p>
          </div>
          <Button variant="contained" endIcon={<NavigateNextIcon />} onClick={() => onSelect(scheme)}>
            Select Scheme
          </Button>
        </div>

        <div className={styles.details}>
          <ValueRow label="AMC Name" value={scheme.amcName || scheme.providerName} />
          <ValueRow label="Category" value={scheme.categoryPath} />
          <ValueRow label="Plan" value={scheme.plan} />
          <ValueRow label="Option" value={scheme.option} />
          <ValueRow label="ISIN" value={scheme.identifiers.isin} />
          <ValueRow label="AMFI Identifier" value={scheme.identifiers.amfi} />
          <ValueRow label="RTA Identifier" value={scheme.identifiers.rta} />
          <ValueRow label="Minimum Amount" value={minimumAmount} />
          <ValueRow label="Maximum Amount" value={maximumAmount} />
        </div>
      </CardContent>
    </Card>
  );
};

export default SchemeCard;
