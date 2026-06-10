import { ondcApi } from './ondcApi';
import type { OndcApiResponse, SelectQuote } from '../types/ondc';
import type { ParsedScheme } from '../types/scheme';

export const selectScheme = async (
  scheme: ParsedScheme,
  transactionId: string,
  amount: number,
  customerPan: string,
): Promise<OndcApiResponse<SelectQuote>> => {
  const fulfillmentId = scheme.fulfillmentIds[0];
  const response = await ondcApi.post('/mf/select', {
    transaction_id: transactionId,
    provider_id: scheme.providerId,
    item_id: scheme.itemId,
    scheme_item_id: scheme.schemeItemId,
    fulfillment_id: fulfillmentId,
    fulfillment_type: scheme.fulfillmentTypes.some((type) => type.toUpperCase().includes('SIP')) ? 'SIP' : 'LUMPSUM',
    amount,
    customer_pan: customerPan,
    arn: 'ARN-000000',
    raw_overrides: {},
  });

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
