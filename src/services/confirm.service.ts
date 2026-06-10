import { ondcApi } from './ondcApi';
import type { OndcApiResponse, OrderDetails } from '../types/ondc';

export const confirmOrder = async (
  orderDetails: OrderDetails,
): Promise<OndcApiResponse<OrderDetails>> => {
  const response = await ondcApi.post('/mf/confirm', {
    transaction_id: orderDetails.transactionId,
    provider_id: '',
    order_id: orderDetails.buyerOrderId,
    raw_overrides: {},
    payment: {
      id: orderDetails.paymentReference ?? orderDetails.messageId,
      status: 'NOT-PAID',
    },
  });

  return {
    action: '/confirm',
    transactionId: response.data.transaction_id,
    messageId: response.data.message_id,
    data: {
      ...orderDetails,
      transactionId: response.data.transaction_id,
      messageId: response.data.message_id,
      status: 'IN_PROGRESS',
      submittedAt: new Date().toISOString(),
    },
  };
};
