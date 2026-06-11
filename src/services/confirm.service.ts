import { ondcApi } from './ondcApi';
import type { InvestorDetails } from '../types/investor';
import type { OndcApiResponse, OrderDetails } from '../types/ondc';
import type { ParsedScheme } from '../types/scheme';
import type { TransactionDetails } from '../types/transaction';
import type { SelectedSchemePayload } from '../utils/schemeMapper';

export interface ConfirmOrderPayload {
  investorDetails: InvestorDetails;
  investmentTransactionId: string;
  orderDetails: OrderDetails;
  orderId: string;
  paymentId: string;
  providerId: string;
  selectedScheme: ParsedScheme;
  selectedSchemePayload?: SelectedSchemePayload;
  transactionDetails: TransactionDetails;
  formSubmissionId?: string;
}

const isConfirmOrderPayload = (value: ConfirmOrderPayload | OrderDetails): value is ConfirmOrderPayload =>
  'selectedScheme' in value;

export const confirmOrder = async (
  payload: ConfirmOrderPayload | OrderDetails,
): Promise<OndcApiResponse<OrderDetails>> => {
  const orderDetails = isConfirmOrderPayload(payload) ? payload.orderDetails : payload;
  const fulfillmentId =
    isConfirmOrderPayload(payload)
      ? payload.selectedSchemePayload?.fulfillment_ids[0] ?? payload.selectedScheme.fulfillmentIds[0]
      : undefined;
  const body = isConfirmOrderPayload(payload)
    ? {
        transaction_id: payload.investmentTransactionId,
        provider_id: payload.providerId,
        order_id: payload.orderId,
        item_id: payload.selectedScheme.itemId,
        fulfillment_id: fulfillmentId,
        fulfillment_type: payload.transactionDetails.transactionType === 'SIP Registration' ? 'SIP' : 'LUMPSUM',
        amount: payload.transactionDetails.amount,
        customer_pan: payload.investorDetails.pan,
        customer_ip: window.location.hostname,
        customer_phone: payload.investorDetails.mobileNumber,
        arn: 'ARN-000000',
        form_id: payload.formSubmissionId ? 'investor_details_form' : undefined,
        form_submission_id: payload.formSubmissionId,
        payment_id: payload.paymentId,
        payment_status: 'NOT-PAID',
        payment_mode: payload.transactionDetails.paymentMode,
        source_bank_code: 'HDFC',
        source_bank_account_number: payload.investorDetails.bankAccount,
        source_bank_account_name: payload.investorDetails.investorName,
        source_bank_account_type: 'SAVINGS',
        raw_overrides: {},
      }
    : {
        transaction_id: orderDetails.transactionId,
        ...(orderDetails.providerId ? { provider_id: orderDetails.providerId } : {}),
        order_id: orderDetails.buyerOrderId,
        raw_overrides: {},
        payment: {
          id: orderDetails.paymentReference ?? orderDetails.messageId,
          status: 'NOT-PAID',
        },
      };
  const params = isConfirmOrderPayload(payload)
    ? {
        bpp_id: payload.selectedScheme.bppId,
        bpp_uri: payload.selectedScheme.bppUri,
      }
    : undefined;
  const response = await ondcApi.post('/mf/confirm', body, { params });

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
