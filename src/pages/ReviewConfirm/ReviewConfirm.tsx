import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentsIcon from '@mui/icons-material/Payments';
import { Button, Card, CardContent, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmOrder } from '../../services/confirm.service';
import { initOrder } from '../../services/init.service';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import { formatInr } from '../../utils/formatters';
import styles from '../page.module.scss';

const ReviewConfirm = () => {
  const navigate = useNavigate();
  const investorDetails = useMfJourneyStore((state) => state.investorDetails);
  const selectedScheme = useMfJourneyStore((state) => state.selectedScheme);
  const transactionDetails = useMfJourneyStore((state) => state.transactionDetails);
  const orderDetails = useMfJourneyStore((state) => state.orderDetails);
  const setOrderDetails = useMfJourneyStore((state) => state.setOrderDetails);
  const setCurrentStep = useMfJourneyStore((state) => state.setCurrentStep);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!selectedScheme) {
      setCurrentStep(1);
      navigate('/catalogue');
      return;
    }

    setIsConfirming(true);
    const draftOrder =
      orderDetails ??
      (
        await initOrder({
          investorDetails,
          selectedScheme,
          transactionDetails,
        })
      ).data;
    const response = await confirmOrder(draftOrder);
    setOrderDetails(response.data);
    setCurrentStep(4);
    setIsConfirming(false);
    navigate('/tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card className={styles.panel}>
      <CardContent className={styles.content}>
        <div className={styles.notice}>
          Before submitting, show scheme risk, cut-off time, NAV applicability, lock-in, exit load,
          suitability and payment authorization confirmation.
        </div>

        <div className={styles.grid}>
          <TextField label="Investor" value={investorDetails.investorName} InputProps={{ readOnly: true }} />
          <TextField label="Scheme" value={selectedScheme?.name ?? 'No scheme selected'} InputProps={{ readOnly: true }} />
          <TextField label="Transaction" value={transactionDetails.transactionType} InputProps={{ readOnly: true }} />
          <TextField label="Amount" value={formatInr(transactionDetails.amount)} InputProps={{ readOnly: true }} />
          <TextField label="Expected ONDC Call" value="/select -> /init -> /confirm" InputProps={{ readOnly: true }} />
          <TextField
            label="Buyer Order ID"
            value={orderDetails?.buyerOrderId ?? 'BUY-ORD-PENDING'}
            InputProps={{ readOnly: true }}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/transaction-setup')}>
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<PaymentsIcon />}
            onClick={handleConfirm}
            disabled={isConfirming || !selectedScheme}
          >
            Confirm & Pay
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewConfirm;
