import { ondcApi } from './ondcApi';
import type { OndcApiResponse, TrackingEvent } from '../types/ondc';

export const getOrderStatus = async (
  buyerOrderId: string,
  transactionId?: string,
): Promise<OndcApiResponse<TrackingEvent[]>> => {
  const response = await ondcApi.post('/mf/status', {
    transaction_id: transactionId,
    order_id: buyerOrderId,
    raw_overrides: {},
  });

  return {
    action: '/status',
    transactionId: response.data.transaction_id,
    messageId: response.data.message_id,
    data: [
      {
        id: response.data.message_id,
        title: '/status sent',
        description: 'Status request sent. Await /on_status or /on_update over the realtime channel.',
        state: 'active',
      },
    ],
  };
};
