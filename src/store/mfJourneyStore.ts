import { create } from 'zustand';
import type { InvestorDetails } from '../types/investor';
import type { OndcRealtimeEvent, OrderDetails, SearchStatus, SelectQuote, WebSocketStatus } from '../types/ondc';
import type { OndcCategory, OndcFulfillment, OndcProvider, ParsedCatalog, ParsedScheme } from '../types/scheme';
import type { TransactionDetails } from '../types/transaction';
import type { SelectedSchemePayload } from '../utils/schemeMapper';
import { amountToWords } from '../utils/formatters';

const defaultInvestorDetails: InvestorDetails = {
  investorName: 'Aarav Sharma',
  mobileNumber: '9876543210',
  email: 'aarav@example.com',
  pan: 'ABCDE1234F',
  dateOfBirth: '1992-08-15',
  accountType: 'Individual',
  kycStatus: 'KYC Verified',
  riskProfile: 'Moderate',
  bankAccount: 'HDFC Bank **** 4521',
  nominee: 'Meera Sharma',
};

const defaultTransactionDetails: TransactionDetails = {
  transactionType: 'Lumpsum Purchase',
  amount: 25000,
  amountInWords: amountToWords(25000),
  paymentMode: 'UPI',
  folio: 'New Folio',
  sipFrequency: 'Not Applicable',
  startDate: '2026-06-15',
  declaration: 'Terms accepted',
};

interface MfJourneyState {
  investorDetails: InvestorDetails;
  searchTransactionId?: string;
  searchStatus: SearchStatus;
  websocketStatus: WebSocketStatus;
  searchStartedAt?: string;
  searchError?: string;
  providers: OndcProvider[];
  categories: OndcCategory[];
  fulfillments: OndcFulfillment[];
  schemes: ParsedScheme[];
  rawCatalog?: ParsedCatalog;
  realtimeEvents: OndcRealtimeEvent[];
  selectedScheme?: ParsedScheme;
  selectedSchemePayload?: SelectedSchemePayload;
  selectedQuote?: SelectQuote;
  transactionDetails: TransactionDetails;
  orderDetails?: OrderDetails;
  currentStep: number;
  setInvestorDetails: (details: InvestorDetails) => void;
  startSearchState: () => void;
  setSearchAcknowledged: (transactionId: string) => void;
  setSearchWaiting: () => void;
  setSearchCatalog: (catalog: ParsedCatalog) => void;
  setSearchError: (error: string) => void;
  setWebsocketStatus: (status: WebSocketStatus) => void;
  recordRealtimeEvent: (event: OndcRealtimeEvent) => void;
  setSelectedScheme: (scheme: ParsedScheme, selection?: SelectedSchemePayload, quote?: SelectQuote) => void;
  setTransactionDetails: (details: TransactionDetails) => void;
  setOrderDetails: (details: OrderDetails) => void;
  setCurrentStep: (step: number) => void;
  startNewTransaction: () => void;
  resetJourney: () => void;
}

export const useMfJourneyStore = create<MfJourneyState>((set) => ({
  investorDetails: defaultInvestorDetails,
  transactionDetails: defaultTransactionDetails,
  searchStatus: 'IDLE',
  websocketStatus: 'DISCONNECTED',
  providers: [],
  categories: [],
  fulfillments: [],
  schemes: [],
  realtimeEvents: [],
  currentStep: 0,
  setInvestorDetails: (details) => set({ investorDetails: details }),
  startSearchState: () =>
    set({
      searchStatus: 'SEARCHING',
      websocketStatus: 'DISCONNECTED',
      searchStartedAt: new Date().toISOString(),
      searchError: undefined,
      searchTransactionId: undefined,
      providers: [],
      categories: [],
      fulfillments: [],
      schemes: [],
      rawCatalog: undefined,
      realtimeEvents: [],
    }),
  setSearchAcknowledged: (transactionId) =>
    set({
      searchTransactionId: transactionId,
      searchStatus: 'ACK_RECEIVED',
    }),
  setSearchWaiting: () =>
    set((state) => ({
      searchStatus: state.searchStatus === 'ACK_RECEIVED' ? 'WAITING_FOR_ON_SEARCH' : state.searchStatus,
    })),
  setSearchCatalog: (catalog) =>
    set({
      searchStatus: 'CATALOG_RECEIVED',
      providers: catalog.providers,
      categories: catalog.categories,
      fulfillments: catalog.fulfillments,
      schemes: catalog.schemes,
      rawCatalog: catalog,
      searchError: catalog.schemes.length ? undefined : 'Catalogue received, but no schemes were present.',
    }),
  setSearchError: (error) => set({ searchStatus: 'ERROR', searchError: error }),
  setWebsocketStatus: (status) => set({ websocketStatus: status }),
  recordRealtimeEvent: (event) =>
    set((state) => ({
      realtimeEvents: [event, ...state.realtimeEvents].slice(0, 50),
    })),
  setSelectedScheme: (scheme, selection, quote) =>
    set({ selectedScheme: scheme, selectedSchemePayload: selection, selectedQuote: quote }),
  setTransactionDetails: (details) => set({ transactionDetails: details }),
  setOrderDetails: (details) => set({ orderDetails: details }),
  setCurrentStep: (step) => set({ currentStep: step }),
  startNewTransaction: () =>
    set({
      selectedScheme: undefined,
      selectedSchemePayload: undefined,
      selectedQuote: undefined,
      transactionDetails: defaultTransactionDetails,
      orderDetails: undefined,
      currentStep: 1,
    }),
  resetJourney: () =>
    set({
      investorDetails: defaultInvestorDetails,
      searchTransactionId: undefined,
      searchStatus: 'IDLE',
      websocketStatus: 'DISCONNECTED',
      searchStartedAt: undefined,
      searchError: undefined,
      providers: [],
      categories: [],
      fulfillments: [],
      schemes: [],
      rawCatalog: undefined,
      realtimeEvents: [],
      selectedScheme: undefined,
      selectedSchemePayload: undefined,
      selectedQuote: undefined,
      transactionDetails: defaultTransactionDetails,
      orderDetails: undefined,
      currentStep: 0,
    }),
}));
