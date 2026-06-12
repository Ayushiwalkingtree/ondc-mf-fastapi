import { ondcApi } from './ondcApi';
import type { SearchInitiatedResponse, SearchStatusResponse } from '../types/ondc';
import type { SchemeSearchParams } from '../types/scheme';

export const searchSchemes = async (
  params: SchemeSearchParams,
): Promise<SearchInitiatedResponse> => {
  const response = await ondcApi.post<SearchInitiatedResponse>('/mf/restart-search', {
    intent: params.intent || 'mutual funds',
    provider_id: params.provider_id || '',
    category: params.category || '',
    session_id: params.session_id,
    subscriber_url: params.subscriber_url,
    raw_overrides: params.raw_overrides ?? {},
  });

  return response.data;
};

export const getSearchStatus = async (trackingId: string): Promise<SearchStatusResponse> => {
  const response = await ondcApi.get<SearchStatusResponse>(`/mf/search-status/${encodeURIComponent(trackingId)}`);

  return response.data;
};
