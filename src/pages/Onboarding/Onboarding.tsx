import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Button, Card, CardContent } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import FormField, { type FieldOption } from '../../components/FormField/FormField';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import type { InvestorDetails } from '../../types/investor';
import styles from '../page.module.scss';

const accountTypeOptions: FieldOption[] = ['Individual', 'Joint', 'NRI', 'Minor'].map((value) => ({
  label: value,
  value,
}));

const kycStatusOptions: FieldOption[] = ['KYC Verified', 'KYC Pending', 'KYC Failed'].map((value) => ({
  label: value,
  value,
}));

const riskProfileOptions: FieldOption[] = ['Moderate', 'Conservative', 'Aggressive'].map((value) => ({
  label: value,
  value,
}));

const Onboarding = () => {
  const navigate = useNavigate();
  const investorDetails = useMfJourneyStore((state) => state.investorDetails);
  const setInvestorDetails = useMfJourneyStore((state) => state.setInvestorDetails);
  const setCurrentStep = useMfJourneyStore((state) => state.setCurrentStep);
  const { control, handleSubmit } = useForm<InvestorDetails>({
    defaultValues: investorDetails,
    mode: 'onBlur',
  });

  const submit = (values: InvestorDetails) => {
    setInvestorDetails(values);
    setCurrentStep(1);
    navigate('/catalogue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card className={styles.panel}>
      <CardContent className={styles.content}>
        <div className={styles.notice}>
          This is a basic UI prototype. Actual implementation must include ONDC protocol signing,
          registry lookup, participant onboarding, consent, KYC, payment gateway/UPI, BSE/RTA/NAV
          validations and audit logs.
        </div>

        <form onSubmit={handleSubmit(submit)}>
          <div className={styles.grid}>
            <FormField control={control} name="investorName" label="Investor Name" required />
            <FormField
              control={control}
              name="mobileNumber"
              label="Mobile Number"
              required
              inputProps={{ maxLength: 10 }}
            />
            <FormField control={control} name="email" label="Email" type="email" required />
            <FormField control={control} name="pan" label="PAN" required inputProps={{ maxLength: 10 }} />
            <FormField control={control} name="dateOfBirth" label="Date of Birth" type="date" required />
            <FormField control={control} name="accountType" label="Account Type" options={accountTypeOptions} />
            <FormField control={control} name="kycStatus" label="KYC Status" options={kycStatusOptions} />
            <FormField control={control} name="riskProfile" label="Risk Profile" options={riskProfileOptions} />
            <FormField control={control} name="bankAccount" label="Bank Account" required />
            <FormField control={control} name="nominee" label="Nominee" />
          </div>

          <div className={styles.actions}>
            <Button type="submit" variant="contained" endIcon={<NavigateNextIcon />}>
              Continue to ONDC Search
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default Onboarding;
