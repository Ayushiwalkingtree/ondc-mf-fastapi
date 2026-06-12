import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { InvestorDetails } from '../types/investor';
import type { OndcRealtimeEvent, OrderDetails, SearchStatus, SelectQuote, WebSocketStatus } from '../types/ondc';
import type { OndcCategory, OndcFulfillment, OndcProvider, ParsedCatalog, ParsedScheme } from '../types/scheme';
import type { TransactionDetails } from '../types/transaction';
import type { SelectedSchemePayload } from '../utils/schemeMapper';
import { amountToWords } from '../utils/formatters';

export interface InvestorFormResponse {
  success?: boolean;
  submission_id?: string;
  [key: string]: unknown;
}

export interface WorkbenchSession {
  sessionId?: string;
  flowId?: string;
  transactionId?: string;
  subscriberUrl?: string;
}

export interface InvestorFormMeta {
  formId?: string;
  formUrl?: string;
}

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
  originalSelectTransactionId?: string;
  investmentTransactionId?: string;
  secondSelectTransactionId?: string;
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
  onSelectPayload?: unknown;
  finalOnSelectPayload?: unknown;
  initPayload?: unknown;
  onInitPayload?: unknown;
  confirmPayload?: unknown;
  onConfirmPayload?: unknown;
  statusPayload?: unknown;
  onStatusPayload?: unknown;
  investorFormResponse?: InvestorFormResponse;
  investorFormMeta?: InvestorFormMeta;
  formCompleted: boolean;
  formSubmissionId?: string;
  workbenchSession?: WorkbenchSession;
  secondSelectPayload?: unknown;
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
  setOriginalSelectTransactionId: (transactionId: string) => void;
  setInvestmentTransactionId: (transactionId: string) => void;
  setSecondSelectTransactionId: (transactionId: string) => void;
  setOnSelectPayload: (payload: unknown, final?: boolean) => void;
  setInitPayload: (payload: unknown) => void;
  setOnInitPayload: (payload: unknown) => void;
  setConfirmPayload: (payload: unknown) => void;
  setOnConfirmPayload: (payload: unknown) => void;
  setStatusPayload: (payload: unknown) => void;
  setOnStatusPayload: (payload: unknown) => void;
  setInvestorFormResponse: (response: InvestorFormResponse) => void;
  setInvestorFormMeta: (meta: InvestorFormMeta) => void;
  setFormSubmissionId: (submissionId: string) => void;
  setWorkbenchSession: (session: WorkbenchSession) => void;
  setSecondSelectPayload: (payload: unknown) => void;
  setSelectedScheme: (scheme: ParsedScheme, selection?: SelectedSchemePayload, quote?: SelectQuote) => void;
  setTransactionDetails: (details: TransactionDetails) => void;
  setOrderDetails: (details: OrderDetails) => void;
  setCurrentStep: (step: number) => void;
  startNewTransaction: () => void;
  resetJourney: () => void;
}

export const useMfJourneyStore = create<MfJourneyState>()(
  persist(
    (set) => ({
  investorDetails: defaultInvestorDetails,
  transactionDetails: defaultTransactionDetails,
  searchStatus: 'IDLE',
  websocketStatus: 'DISCONNECTED',
  providers: [],
  categories: [],
  fulfillments: [],
  schemes: [],
  realtimeEvents: [],
  formCompleted: false,
  currentStep: 0,
  setInvestorDetails: (details) => set({ investorDetails: details }),
  startSearchState: () =>
    set({
      searchStatus: 'SEARCHING',
      websocketStatus: 'DISCONNECTED',
      searchStartedAt: new Date().toISOString(),
      searchError: undefined,
      searchTransactionId: undefined,
      originalSelectTransactionId: undefined,
      investmentTransactionId: undefined,
      secondSelectTransactionId: undefined,
      providers: [],
      categories: [],
      fulfillments: [],
      schemes: [],
      rawCatalog: undefined,
      realtimeEvents: [],
      selectedScheme: undefined,
      selectedSchemePayload: undefined,
      selectedQuote: undefined,
      onSelectPayload: undefined,
      finalOnSelectPayload: undefined,
      initPayload: undefined,
      onInitPayload: undefined,
      confirmPayload: undefined,
      onConfirmPayload: undefined,
      statusPayload: undefined,
      onStatusPayload: undefined,
      investorFormResponse: undefined,
      investorFormMeta: undefined,
      formCompleted: false,
      formSubmissionId: undefined,
      secondSelectPayload: undefined,
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
  setOriginalSelectTransactionId: (transactionId) => set({ originalSelectTransactionId: transactionId }),
  setInvestmentTransactionId: (transactionId) =>
    set({
      investmentTransactionId: transactionId,
      secondSelectTransactionId: undefined,
      onSelectPayload: undefined,
      finalOnSelectPayload: undefined,
      initPayload: undefined,
      onInitPayload: undefined,
      confirmPayload: undefined,
      onConfirmPayload: undefined,
      statusPayload: undefined,
      onStatusPayload: undefined,
      investorFormResponse: undefined,
      investorFormMeta: undefined,
      formCompleted: false,
      formSubmissionId: undefined,
      workbenchSession: undefined,
      secondSelectPayload: undefined,
      orderDetails: undefined,
    }),
  setSecondSelectTransactionId: (transactionId) => set({ secondSelectTransactionId: transactionId }),
  setOnSelectPayload: (payload, final = false) =>
    set(final ? { finalOnSelectPayload: payload } : { onSelectPayload: payload, finalOnSelectPayload: undefined }),
  setInitPayload: (payload) => set({ initPayload: payload }),
  setOnInitPayload: (payload) => set({ onInitPayload: payload }),
  setConfirmPayload: (payload) => set({ confirmPayload: payload }),
  setOnConfirmPayload: (payload) => set({ onConfirmPayload: payload }),
  setStatusPayload: (payload) => set({ statusPayload: payload }),
  setOnStatusPayload: (payload) => set({ onStatusPayload: payload }),
  setInvestorFormResponse: (response) => {
    const submissionId = response.submission_id;
    set({
      investorFormResponse: response,
      formCompleted: response.success === true && Boolean(submissionId),
      formSubmissionId: submissionId,
    });
  },
  setInvestorFormMeta: (meta) => set({ investorFormMeta: meta }),
  setFormSubmissionId: (submissionId) => set({ formSubmissionId: submissionId }),
  setWorkbenchSession: (session) => set({ workbenchSession: session }),
  setSecondSelectPayload: (payload) => set({ secondSelectPayload: payload }),
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
      originalSelectTransactionId: undefined,
      investmentTransactionId: undefined,
      secondSelectTransactionId: undefined,
      onSelectPayload: undefined,
      finalOnSelectPayload: undefined,
      initPayload: undefined,
      onInitPayload: undefined,
      confirmPayload: undefined,
      onConfirmPayload: undefined,
      statusPayload: undefined,
      onStatusPayload: undefined,
      investorFormResponse: undefined,
      investorFormMeta: undefined,
      formCompleted: false,
      formSubmissionId: undefined,
      workbenchSession: undefined,
      secondSelectPayload: undefined,
      transactionDetails: defaultTransactionDetails,
      orderDetails: undefined,
      currentStep: 1,
    }),
  resetJourney: () =>
    set({
      investorDetails: defaultInvestorDetails,
      searchTransactionId: undefined,
      originalSelectTransactionId: undefined,
      investmentTransactionId: undefined,
      secondSelectTransactionId: undefined,
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
      onSelectPayload: undefined,
      finalOnSelectPayload: undefined,
      initPayload: undefined,
      onInitPayload: undefined,
      confirmPayload: undefined,
      onConfirmPayload: undefined,
      statusPayload: undefined,
      onStatusPayload: undefined,
      investorFormResponse: undefined,
      investorFormMeta: undefined,
      formCompleted: false,
      formSubmissionId: undefined,
      workbenchSession: undefined,
      secondSelectPayload: undefined,
      transactionDetails: defaultTransactionDetails,
      orderDetails: undefined,
      currentStep: 0,
    }),
    }),
    {
      name: 'ondc-mf-journey',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        investorDetails: state.investorDetails,
        searchTransactionId: state.searchTransactionId,
        originalSelectTransactionId: state.originalSelectTransactionId,
        investmentTransactionId: state.investmentTransactionId,
        secondSelectTransactionId: state.secondSelectTransactionId,
        searchStatus: state.searchStatus,
        providers: state.providers,
        categories: state.categories,
        fulfillments: state.fulfillments,
        schemes: state.schemes,
        rawCatalog: state.rawCatalog,
        realtimeEvents: state.realtimeEvents,
        selectedScheme: state.selectedScheme,
        selectedSchemePayload: state.selectedSchemePayload,
        selectedQuote: state.selectedQuote,
        onSelectPayload: state.onSelectPayload,
        finalOnSelectPayload: state.finalOnSelectPayload,
        initPayload: state.initPayload,
        onInitPayload: state.onInitPayload,
        confirmPayload: state.confirmPayload,
        onConfirmPayload: state.onConfirmPayload,
        statusPayload: state.statusPayload,
        onStatusPayload: state.onStatusPayload,
        investorFormResponse: state.investorFormResponse,
        investorFormMeta: state.investorFormMeta,
        formCompleted: state.formCompleted,
        formSubmissionId: state.formSubmissionId,
        workbenchSession: state.workbenchSession,
        secondSelectPayload: state.secondSelectPayload,
        transactionDetails: state.transactionDetails,
        orderDetails: state.orderDetails,
        currentStep: state.currentStep,
      }),
    },
  ),
);
