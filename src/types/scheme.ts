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
  category_id?: string;
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

export interface ParsedScheme {
  id: string;
  name: string;
  amcName?: string;
  providerId: string;
  providerName: string;
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
  exitLoad?: string;
  nfo: NfoData;
  documents: SchemeDocuments;
  fulfillmentIds: string[];
  fulfillmentTypes: string[];
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
  raw_overrides?: Record<string, unknown>;
}
