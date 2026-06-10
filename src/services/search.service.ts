import { ondcApi } from './ondcApi';
import type { SearchInitiatedResponse } from '../types/ondc';
import type { SchemeSearchParams } from '../types/scheme';

export const searchSchemes = async (
  params: SchemeSearchParams,
): Promise<SearchInitiatedResponse> => {
  const response = await ondcApi.post<SearchInitiatedResponse>('/mf/search', {
    intent: params.intent || 'mutual funds',
    provider_id: params.provider_id || '',
    category: params.category || '',
    raw_overrides: params.raw_overrides ?? {},
  });

  return response.data;
};
