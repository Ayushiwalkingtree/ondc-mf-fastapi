import type { InvestorDetails } from './investor';
import type { ParsedScheme } from './scheme';
import type { TransactionDetails } from './transaction';
import type { SelectedSchemePayload } from '../utils/schemeMapper';

export type OndcAction = '/search' | '/select' | '/init' | '/confirm' | '/status';
export type OrderStatus = 'DRAFT' | 'INITIATED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface OndcApiResponse<T> {
  action: OndcAction;
  transactionId: string;
  messageId: string;
  data: T;
}

export interface SelectQuote {
  quoteId: string;
  schemeId: string;
  navApplicability: string;
  cutoffTime: string;
  terms: string[];
}

export interface OrderDetails {
  buyerOrderId: string;
  transactionId: string;
  messageId: string;
  status: OrderStatus;
  providerId?: string;
  paymentReference?: string;
  submittedAt?: string;
}

export interface InitOrderPayload {
  investorDetails: InvestorDetails;
  investmentTransactionId?: string;
  searchTransactionId?: string;
  selectedScheme: ParsedScheme;
  selectedSchemePayload?: SelectedSchemePayload;
  transactionDetails: TransactionDetails;
  formSubmissionId?: string;
}

export type SearchStatus =
  | 'IDLE'
  | 'SEARCHING'
  | 'ACK_RECEIVED'
  | 'WAITING_FOR_ON_SEARCH'
  | 'CATALOG_RECEIVED'
  | 'ERROR';

export type WebSocketStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface SearchInitiatedResponse {
  success: boolean;
  transaction_id: string;
  tracking_id?: string;
  status?: string;
}

export interface SearchStatusResponse {
  status: 'initiated' | 'waiting_for_webhook' | 'completed' | 'failed';
  catalogue?: unknown;
  transaction_id?: string;
  error?: string;
}

export interface OndcRealtimeEvent {
  event:
    | 'ON_SEARCH_RECEIVED'
    | 'ON_SELECT_RECEIVED'
    | 'ON_INIT_RECEIVED'
    | 'ON_CONFIRM_RECEIVED'
    | 'ON_STATUS_RECEIVED'
    | 'ON_UPDATE_RECEIVED'
    | string;
  transaction_id: string;
  payload: unknown;
}

export interface TrackingEvent {
  id: string;
  title: string;
  description: string;
  state: 'done' | 'active' | 'pending';
}
