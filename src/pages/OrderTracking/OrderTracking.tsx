import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Button, Card, CardContent } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Timeline from '../../components/Timeline/Timeline';
import { getOrderStatus } from '../../services/status.service';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import type { TrackingEvent } from '../../types/ondc';
import styles from '../page.module.scss';

const OrderTracking = () => {
  const navigate = useNavigate();
  const orderDetails = useMfJourneyStore((state) => state.orderDetails);
  const startNewTransaction = useMfJourneyStore((state) => state.startNewTransaction);
  const [events, setEvents] = useState<TrackingEvent[]>([]);

  useEffect(() => {
    const buyerOrderId = orderDetails?.buyerOrderId ?? 'BUY-ORD-PENDING';
    void getOrderStatus(buyerOrderId).then((response) => setEvents(response.data));
  }, [orderDetails?.buyerOrderId]);

  const handleStartNew = () => {
    startNewTransaction();
    navigate('/catalogue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card className={styles.panel}>
      <CardContent className={styles.content}>
        <div className={styles.successBox}>
          <h3>Order Submitted Successfully</h3>
          <p>Your MF transaction has been submitted to the ONDC network. Track order status below.</p>
        </div>

        <Timeline items={events} />

        <div className={styles.actions}>
          <Button variant="contained" color="secondary" startIcon={<RestartAltIcon />} onClick={handleStartNew}>
            Start New Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderTracking;
