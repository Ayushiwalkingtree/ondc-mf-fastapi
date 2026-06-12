export type SchemeCategory = string;
export type SchemeRisk = string;

export interface OndcDescriptor {
  name?: string;
  code?: string;
  short_desc?: string;
  long_desc?: string;
  images?: unknown[];
}

export interface OndcTagListItem {
  descriptor?: OndcDescriptor;
  value?: unknown;
}

export interface OndcTag {
  descriptor?: OndcDescriptor;
  display?: boolean;
  list?: OndcTagListItem[];
}

export interface OndcCategory {
  id?: string;
  parent_category_id?: string;
  descriptor?: OndcDescriptor;
  tags?: OndcTag[];
  [key: string]: unknown;
}

export interface OndcFulfillment {
  id?: string;
  type?: string;
  tags?: OndcTag[];
  [key: string]: unknown;
}

export interface OndcProvider {
  id?: string;
  descriptor?: OndcDescriptor;
  categories?: OndcCategory[];
  fulfillments?: OndcFulfillment[];
  items?: OndcItem[];
  tags?: OndcTag[];
  [key: string]: unknown;
}

export interface OndcItem {
  id?: string;
  descriptor?: OndcDescriptor;
  creator?: {
    descriptor?: OndcDescriptor;
    [key: string]: unknown;
  };
  category_id?: string;
  parent_item_id?: string;
  fulfillment_ids?: string[];
  fulfillment_id?: string;
  tags?: OndcTag[];
  matched?: boolean;
  recommended?: boolean;
  [key: string]: unknown;
}

export interface OndcCatalog {
  providers?: OndcProvider[];
  categories?: OndcCategory[];
  fulfillments?: OndcFulfillment[];
  [key: string]: unknown;
}

export interface OndcOnSearchPayload {
  context?: Record<string, unknown>;
  message?: {
    catalog?: OndcCatalog;
    [key: string]: unknown;
  };
  error?: Record<string, unknown>;
}

export interface ThresholdValue {
  label: string;
  value: string;
  source: string;
}

export interface SchemeIdentifiers {
  isin?: string;
  rta?: string;
  amfi?: string;
  [key: string]: string | undefined;
}

export interface SchemeDocuments {
  consumerTermsUrl?: string;
  offerDocumentUrl?: string;
  [key: string]: string | undefined;
}

export interface NfoData {
  startDate?: string;
  endDate?: string;
  allotmentDate?: string;
  reopenDate?: string;
}

export interface LumpsumRules {
  minimumAmount?: string;
  maximumAmount?: string;
  amountMultiples?: string;
}

export interface SipRule {
  id?: string;
  type?: string;
  frequency?: string;
  frequencyDayType?: string;
  minAmount?: string;
  maxAmount?: string;
  installmentMin?: string;
  installmentMax?: string;
}

export interface RedemptionRules {
  minUnits?: string;
  maxUnits?: string;
}

export interface SchemeRules {
  lumpsum?: LumpsumRules;
  sip: SipRule[];
  redemption?: RedemptionRules;
  instantRedemption?: RedemptionRules;
}

export interface ParsedFulfillmentDetails {
  id?: string;
  type?: string;
  label: string;
  frequency?: string;
  thresholds: ThresholdValue[];
}

export interface ParsedScheme {
  id: string;
  name: string;
  amcName?: string;
  providerId: string;
  providerName: string;
  bppId?: string;
  bppUri?: string;
  schemeId?: string;
  schemeItemId?: string;
  itemId: string;
  planId?: string;
  categoryId?: string;
  categoryHierarchy: string[];
  categoryPath: string;
  identifiers: SchemeIdentifiers;
  plan?: string;
  option?: string;
  idcwOption?: string;
  status?: string;
  lockInPeriod?: string;
  entryLoad?: string;
  exitLoad?: string;
  nfo: NfoData;
  documents: SchemeDocuments;
  rules: SchemeRules;
  fulfillmentIds: string[];
  fulfillmentTypes: string[];
  fulfillmentDetails: ParsedFulfillmentDetails[];
  transactionChips: string[];
  thresholds: ThresholdValue[];
  rawProvider: OndcProvider;
  rawItem: OndcItem;
  rawFulfillments: OndcFulfillment[];
  rawCategories: OndcCategory[];
}

export interface ParsedCatalog {
  providers: OndcProvider[];
  categories: OndcCategory[];
  fulfillments: OndcFulfillment[];
  schemes: ParsedScheme[];
  rawPayload: OndcOnSearchPayload;
}

export interface SchemeSearchParams {
  intent: string;
  provider_id?: string;
  category?: string;
  session_id?: string;
  subscriber_url?: string;
  raw_overrides?: Record<string, unknown>;
}
