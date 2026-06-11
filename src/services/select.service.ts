import { ondcApi } from './ondcApi';
import type { OndcApiResponse, SelectQuote } from '../types/ondc';
import type { ParsedScheme } from '../types/scheme';

export interface SelectSchemeInput {
  amount: number;
  customerPan: string;
  arn: string;
  euin?: string;
  fulfillmentId?: string;
  fulfillmentType: 'LUMPSUM' | 'SIP';
  subBrokerArn?: string;
  formId?: string;
  formSubmissionId?: string;
  sessionId?: string;
  flowId?: string;
  workbenchTransactionId?: string;
}

export const selectScheme = async (
  scheme: ParsedScheme,
  transactionId: string,
  input: SelectSchemeInput,
): Promise<OndcApiResponse<SelectQuote>> => {
  const fulfillmentId = input.fulfillmentId ?? scheme.fulfillmentIds[0];
  const response = await ondcApi.post(
    '/mf/select',
    {
      transaction_id: transactionId,
      provider_id: scheme.providerId,
      item_id: scheme.itemId,
      scheme_item_id: scheme.schemeItemId,
      fulfillment_id: fulfillmentId,
      fulfillment_type: input.fulfillmentType,
      amount: input.amount,
      customer_pan: input.customerPan,
      arn: input.arn,
      euin: input.euin ?? '',
      sub_broker_arn: input.subBrokerArn ?? '',
      form_id: input.formId,
      form_submission_id: input.formSubmissionId,
      session_id: input.sessionId,
      flow_id: input.flowId,
      workbench_transaction_id: input.workbenchTransactionId,
      raw_overrides: {},
    },
    {
      params: {
        bpp_id: scheme.bppId,
        bpp_uri: scheme.bppUri,
        session_id: input.sessionId,
        flow_id: input.flowId,
        transaction_id: input.workbenchTransactionId,
      },
    },
  );

  const ackStatus = response.data.ack?.message?.ack?.status ?? response.data.ack?.status;
  if (ackStatus && String(ackStatus).toUpperCase() !== 'ACK') {
    throw new Error('ONDC /select returned a negative acknowledgement.');
  }

  return {
    action: '/select',
    transactionId: response.data.transaction_id,
    messageId: response.data.message_id,
    data: {
      quoteId: response.data.message_id,
      schemeId: scheme.schemeId ?? scheme.itemId,
      navApplicability: 'Await /on_select callback for final quote and NAV applicability.',
      cutoffTime: '-',
      terms: [],
    },
  };
};
