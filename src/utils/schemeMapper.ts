import type { ParsedScheme } from '../types/scheme';

export interface SelectedSchemePayload {
  provider_id: string;
  scheme_item_id?: string;
  item_id: string;
  fulfillment_ids: string[];
  ISIN?: string;
  AMFI?: string;
  RTA?: string;
  planDetails: {
    planId?: string;
    plan?: string;
    option?: string;
    idcwOption?: string;
  };
  schemeDetails: ParsedScheme;
  thresholds: ParsedScheme['thresholds'];
  identifiers: ParsedScheme['identifiers'];
  categoryHierarchy: string[];
}

export const mapSchemeToSelection = (scheme: ParsedScheme): SelectedSchemePayload => ({
  provider_id: scheme.providerId,
  scheme_item_id: scheme.schemeItemId,
  item_id: scheme.itemId,
  fulfillment_ids: scheme.fulfillmentIds,
  ISIN: scheme.identifiers.isin,
  AMFI: scheme.identifiers.amfi,
  RTA: scheme.identifiers.rta,
  planDetails: {
    planId: scheme.planId,
    plan: scheme.plan,
    option: scheme.option,
    idcwOption: scheme.idcwOption,
  },
  schemeDetails: scheme,
  thresholds: scheme.thresholds,
  identifiers: scheme.identifiers,
  categoryHierarchy: scheme.categoryHierarchy,
});
