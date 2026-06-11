import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Button, Card, CardContent, Chip } from '@mui/material';
import type { ReactNode } from 'react';
import type { ParsedScheme } from '../../types/scheme';
import styles from './SchemeCard.module.scss';

interface SchemeCardProps {
  scheme: ParsedScheme;
  onViewDetails: (scheme: ParsedScheme) => void;
  onSelect: (scheme: ParsedScheme) => void;
}

const formatPlanPart = (value?: string): string =>
  value
    ? value
        .split(/[\s_]+/)
        .filter(Boolean)
        .map((part) => (part.length <= 4 && part === part.toUpperCase() ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
        .join(' ')
    : '';

const hasValue = (value?: string): value is string => Boolean(value && value.trim());

const DetailItem = ({ label, value }: { label: string; value?: string }) =>
  hasValue(value) ? (
    <div className={styles.detailItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ) : null;

const SummaryBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={styles.summaryBlock}>
    <h4>{title}</h4>
    {children}
  </section>
);

const formatInstallments = (minimum?: string, maximum?: string): string | undefined => {
  if (hasValue(minimum) && hasValue(maximum)) {
    return `${minimum} - ${maximum}`;
  }

  return minimum || maximum;
};

const SchemeCard = ({ scheme, onViewDetails, onSelect }: SchemeCardProps) => {
  const planName = [formatPlanPart(scheme.plan), formatPlanPart(scheme.option)].filter(Boolean).join(' ');
  const monthlySip = scheme.rules.sip.find((rule) =>
    `${rule.type ?? ''} ${rule.frequency ?? ''} ${rule.frequencyDayType ?? ''}`.toLowerCase().includes('monthly'),
  );
  const firstSip = monthlySip ?? scheme.rules.sip[0];
  const showLumpsum = Object.values(scheme.rules.lumpsum ?? {}).some(Boolean);
  const showSip = Boolean(firstSip);

  return (
    <Card className={styles.card}>
      <CardContent className={styles.content}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{scheme.name}</h3>
            {planName ? <p className={styles.plan}>{planName}</p> : null}
          </div>
          <div className={styles.actions}>
            <Button variant="outlined" startIcon={<InfoOutlinedIcon />} onClick={() => onViewDetails(scheme)}>
              View Details
            </Button>
            <Button variant="contained" endIcon={<NavigateNextIcon />} onClick={() => onSelect(scheme)}>
              Select Scheme
            </Button>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <DetailItem label="AMC Name" value={scheme.amcName} />
          <DetailItem label="Category" value={scheme.categoryPath} />
          <DetailItem label="Plan" value={formatPlanPart(scheme.plan)} />
          <DetailItem label="Option" value={formatPlanPart(scheme.option)} />
          <DetailItem label="ISIN" value={scheme.identifiers.isin} />
          <DetailItem label="Exit Load" value={scheme.exitLoad} />
          <DetailItem label="Lock-in Period" value={scheme.lockInPeriod} />
        </div>

        <section className={styles.transactions}>
          <h4>Transaction Types</h4>
          <div className={styles.chips} aria-label="Supported transaction types">
            {scheme.transactionChips.map((chip) => (
              <Chip key={chip} label={chip} size="small" />
            ))}
          </div>
        </section>

        <div className={styles.summaryGrid}>
          {showLumpsum ? (
            <SummaryBlock title="Lumpsum Summary">
              <div className={styles.summaryItems}>
                <DetailItem label="Min Amount" value={scheme.rules.lumpsum?.minimumAmount} />
                <DetailItem label="Max Amount" value={scheme.rules.lumpsum?.maximumAmount} />
              </div>
            </SummaryBlock>
          ) : null}

          {showSip ? (
            <SummaryBlock title="SIP Summary">
              <div className={styles.summaryItems}>
                <DetailItem label="Frequency" value={firstSip?.frequency} />
                <DetailItem label="Min Amount" value={firstSip?.minAmount} />
                <DetailItem label="Max Amount" value={firstSip?.maxAmount} />
                <DetailItem
                  label="Installments"
                  value={formatInstallments(firstSip?.installmentMin, firstSip?.installmentMax)}
                />
              </div>
            </SummaryBlock>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default SchemeCard;
