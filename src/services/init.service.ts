import { ondcApi } from './ondcApi';
import type { InitOrderPayload, OndcApiResponse, OrderDetails } from '../types/ondc';

export const initOrder = async (
  payload: InitOrderPayload,
): Promise<OndcApiResponse<OrderDetails>> => {
  const fulfillmentId = payload.selectedSchemePayload?.fulfillment_ids[0] ?? payload.selectedScheme.fulfillmentIds[0];
  const response = await ondcApi.post('/mf/init', {
    transaction_id: payload.searchTransactionId,
    provider_id: payload.selectedScheme.providerId,
    item_id: payload.selectedScheme.itemId,
    fulfillment_id: fulfillmentId,
    fulfillment_type: payload.transactionDetails.transactionType === 'SIP Registration' ? 'SIP' : 'LUMPSUM',
    amount: payload.transactionDetails.amount,
    customer_pan: payload.investorDetails.pan,
    customer_ip: window.location.hostname,
    customer_phone: payload.investorDetails.mobileNumber,
    arn: 'ARN-000000',
    form_id: payload.selectedScheme.rawItem.xinput ? undefined : 'FORM-PENDING',
    form_submission_id: payload.selectedScheme.rawItem.xinput ? undefined : 'FORM-SUBMISSION-PENDING',
    payment_mode: payload.transactionDetails.paymentMode,
    source_bank_code: 'HDFC',
    source_bank_account_number: payload.investorDetails.bankAccount,
    source_bank_account_name: payload.investorDetails.investorName,
    source_bank_account_type: 'SAVINGS',
    raw_overrides: {},
  });

  return {
    action: '/init',
    transactionId: response.data.transaction_id,
    messageId: response.data.message_id,
    data: {
      buyerOrderId: response.data.message_id,
      transactionId: response.data.transaction_id,
      messageId: response.data.message_id,
      status: 'INITIATED',
    },
  };
};
