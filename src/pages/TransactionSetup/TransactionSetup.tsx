import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Button, Card, CardContent } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import FormField, { type FieldOption } from '../../components/FormField/FormField';
import { initOrder } from '../../services/init.service';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import type { TransactionDetails } from '../../types/transaction';
import { amountToWords } from '../../utils/formatters';
import styles from '../page.module.scss';

const transactionTypeOptions: FieldOption[] = [
  'Lumpsum Purchase',
  'SIP Registration',
  'Additional Purchase',
  'Redemption',
].map((value) => ({ label: value, value }));

const paymentModeOptions: FieldOption[] = ['UPI', 'Net Banking', 'Mandate'].map((value) => ({
  label: value,
  value,
}));

const folioOptions: FieldOption[] = ['New Folio', 'Existing Folio - 1029384'].map((value) => ({
  label: value,
  value,
}));

const sipFrequencyOptions: FieldOption[] = ['Not Applicable', 'Monthly', 'Weekly', 'Quarterly'].map((value) => ({
  label: value,
  value,
}));

const declarationOptions: FieldOption[] = ['Terms accepted', 'Pending'].map((value) => ({
  label: value,
  value,
}));

const TransactionSetup = () => {
  const navigate = useNavigate();
  const investorDetails = useMfJourneyStore((state) => state.investorDetails);
  const searchTransactionId = useMfJourneyStore((state) => state.searchTransactionId);
  const selectedScheme = useMfJourneyStore((state) => state.selectedScheme);
  const selectedSchemePayload = useMfJourneyStore((state) => state.selectedSchemePayload);
  const selectedQuote = useMfJourneyStore((state) => state.selectedQuote);
  const transactionDetails = useMfJourneyStore((state) => state.transactionDetails);
  const setTransactionDetails = useMfJourneyStore((state) => state.setTransactionDetails);
  const setOrderDetails = useMfJourneyStore((state) => state.setOrderDetails);
  const setCurrentStep = useMfJourneyStore((state) => state.setCurrentStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, handleSubmit, setValue } = useForm<TransactionDetails>({
    defaultValues: transactionDetails,
  });

  const amount = useWatch({ control, name: 'amount' });
  const transactionType = useWatch({ control, name: 'transactionType' });

  useEffect(() => {
    setValue('amountInWords', amountToWords(Number(amount)));
  }, [amount, setValue]);

  useEffect(() => {
    if (transactionType === 'SIP Registration') {
      setValue('sipFrequency', 'Monthly');
    } else {
      setValue('sipFrequency', 'Not Applicable');
    }
  }, [setValue, transactionType]);

  const submit = async (values: TransactionDetails) => {
    if (!selectedScheme) {
      setCurrentStep(1);
      navigate('/catalogue');
      return;
    }

    setIsSubmitting(true);
    const details = { ...values, amount: Number(values.amount), amountInWords: amountToWords(Number(values.amount)) };
    setTransactionDetails(details);
    const response = await initOrder({
      investorDetails,
      searchTransactionId,
      selectedScheme,
      selectedSchemePayload,
      transactionDetails: details,
    });
    setOrderDetails(response.data);
    setCurrentStep(3);
    setIsSubmitting(false);
    navigate('/review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card className={styles.panel}>
      <CardContent className={styles.content}>
        <div className={styles.successBox}>
          <h3>{selectedScheme?.name ?? 'Selected Scheme'}</h3>
          <p>
            {selectedScheme
              ? `${selectedScheme.providerName} - ${selectedScheme.categoryPath} - ISIN: ${selectedScheme.identifiers.isin ?? '-'}`
              : 'Choose a scheme from the catalogue first.'}
          </p>
          {selectedQuote ? <p>{selectedQuote.navApplicability}</p> : null}
        </div>

        <form onSubmit={handleSubmit(submit)}>
          <div className={styles.grid}>
            <FormField
              control={control}
              name="transactionType"
              label="Transaction Type"
              options={transactionTypeOptions}
            />
            <FormField control={control} name="amount" label="Amount / Units" type="number" required />
            <FormField control={control} name="amountInWords" label="Amount in Words" disabled />
            <FormField control={control} name="paymentMode" label="Payment Mode" options={paymentModeOptions} />
            <FormField control={control} name="folio" label="Folio" options={folioOptions} />
            <FormField control={control} name="sipFrequency" label="SIP Frequency" options={sipFrequencyOptions} />
            <FormField control={control} name="startDate" label="Start Date" type="date" required />
            <FormField control={control} name="declaration" label="Declaration" options={declarationOptions} />
          </div>

          <div className={styles.actions}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/catalogue')}>
              Back
            </Button>
            <Button type="submit" variant="contained" endIcon={<NavigateNextIcon />} disabled={isSubmitting}>
              Review Order
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransactionSetup;
