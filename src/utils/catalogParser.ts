import type {
  OndcCatalog,
  OndcCategory,
  OndcFulfillment,
  OndcItem,
  OndcOnSearchPayload,
  OndcProvider,
  OndcTag,
  LumpsumRules,
  ParsedFulfillmentDetails,
  ParsedCatalog,
  ParsedScheme,
  RedemptionRules,
  SchemeRules,
  SipRule,
  ThresholdValue,
} from '../types/scheme';

const normalizeKey = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

const keyMatch = (value: unknown, patterns: string[]): boolean => {
  const normalized = normalizeKey(value);
  return patterns.some((pattern) => normalized.includes(pattern));
};

const keyExactMatch = (value: unknown, patterns: string[]): boolean => {
  const normalized = normalizeKey(value);
  return patterns.some((pattern) => normalized === normalizeKey(pattern));
};

const descriptorText = (value?: { name?: string; code?: string; short_desc?: string; long_desc?: string }): string =>
  value?.name || value?.code || value?.short_desc || value?.long_desc || '';

const listValue = (tags: OndcTag[] | undefined, patterns: string[]): string | undefined => {
  for (const tag of tags ?? []) {
    if (keyMatch(tag.descriptor?.code, patterns) || keyMatch(tag.descriptor?.name, patterns)) {
      const direct = tag.list?.find((item) => item.value !== undefined)?.value;
      if (direct !== undefined) {
        return String(direct);
      }
    }

    for (const item of tag.list ?? []) {
      if (keyMatch(item.descriptor?.code, patterns) || keyMatch(item.descriptor?.name, patterns)) {
        return item.value === undefined ? undefined : String(item.value);
      }
    }
  }

  return undefined;
};

const groupedListValue = (
  tags: OndcTag[] | undefined,
  groupPatterns: string[],
  itemPatterns: string[],
): string | undefined => {
  for (const tag of tags ?? []) {
    if (!keyMatch(tag.descriptor?.code, groupPatterns) && !keyMatch(tag.descriptor?.name, groupPatterns)) {
      continue;
    }

    const item = tag.list?.find(
      (entry) => keyExactMatch(entry.descriptor?.code, itemPatterns) || keyExactMatch(entry.descriptor?.name, itemPatterns),
    );
    if (item?.value !== undefined) {
      return String(item.value);
    }
  }

  return undefined;
};

const exactListValue = (tags: OndcTag[] | undefined, patterns: string[]): string | undefined => {
  for (const tag of tags ?? []) {
    if (keyExactMatch(tag.descriptor?.code, patterns) || keyExactMatch(tag.descriptor?.name, patterns)) {
      const direct = tag.list?.find((item) => item.value !== undefined)?.value;
      if (direct !== undefined) {
        return String(direct);
      }
    }

    const item = tag.list?.find(
      (entry) => keyExactMatch(entry.descriptor?.code, patterns) || keyExactMatch(entry.descriptor?.name, patterns),
    );
    if (item?.value !== undefined) {
      return String(item.value);
    }
  }

  return undefined;
};

const allTagValues = (tags: OndcTag[] | undefined): ThresholdValue[] =>
  (tags ?? []).flatMap((tag) =>
    (tag.list ?? []).map((item) => ({
      label: descriptorText(item.descriptor) || descriptorText(tag.descriptor) || 'Value',
      value: item.value === undefined || item.value === null ? '' : String(item.value),
      source: descriptorText(tag.descriptor) || 'Tag',
    })),
  );

const thresholdValues = (tags: OndcTag[] | undefined): ThresholdValue[] =>
  allTagValues(tags).filter((entry) =>
    keyMatch(`${entry.source} ${entry.label}`, [
      'threshold',
      'amount',
      'frequency',
      'installment',
      'cumulative',
      'units',
      'multiples',
      'min',
      'max',
    ]),
  );

const fulfillmentThresholdValues = (tags: OndcTag[] | undefined): ThresholdValue[] => {
  const values = allTagValues(tags);
  const thresholdGroupValues = values.filter((entry) => keyMatch(entry.source, ['threshold']));
  return thresholdGroupValues.length ? thresholdGroupValues : thresholdValues(tags);
};

const providerCategories = (catalog: OndcCatalog, provider: OndcProvider): OndcCategory[] => [
  ...(catalog.categories ?? []),
  ...(provider.categories ?? []),
];

const categoryName = (category?: OndcCategory): string => descriptorText(category?.descriptor) || category?.id || '';

const buildCategoryPath = (categories: OndcCategory[], categoryId?: string): string[] => {
  if (!categoryId) {
    return [];
  }

  const byId = new Map(categories.filter((category) => category.id).map((category) => [category.id as string, category]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(categoryId);

  while (current?.id && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(categoryName(current));
    current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined;
  }

  return path.filter(Boolean).filter((name) => normalizeKey(name) !== 'mutual_funds');
};

const displaySipFrequency = (frequency?: string, frequencyDayType?: string): string | undefined => {
  const normalizedFrequency = normalizeKey(frequency);
  const normalizedDayType = normalizeKey(frequencyDayType);

  if (normalizedFrequency === 'p1m') return 'Monthly SIP';
  if (normalizedFrequency === 'p1d' && normalizedDayType.includes('business')) return 'Daily SIP (Business Days)';
  if (normalizedFrequency === 'p1d' && normalizedDayType.includes('calendar')) return 'Daily SIP (Calendar Days)';
  if (normalizedFrequency === 'p1d') return 'Daily SIP';
  if (normalizedFrequency === 'p1w') return 'Weekly SIP';
  if (normalizedFrequency === 'p3m') return 'Quarterly SIP';

  return frequency;
};

const supportedTransactionChips = (fulfillments: OndcFulfillment[]): string[] => {
  const labels = new Set<string>();
  for (const fulfillment of fulfillments) {
    const type = String(fulfillment.type || listValue(fulfillment.tags, ['type']) || '').toUpperCase();
    const frequency = listValue(fulfillment.tags, ['frequency']) || '';
    const frequencyType = listValue(fulfillment.tags, ['frequency_type', 'frequency_dates']) || '';

    if (type.includes('LUMPSUM')) labels.add('Lumpsum');
    if (type.includes('REDEMPTION') && type.includes('INSTANT')) labels.add('Instant Redemption');
    else if (type.includes('REDEMPTION')) labels.add('Redemption');
    if (type.includes('SIP')) {
      if (keyMatch(`${type} ${frequency} ${frequencyType}`, ['daily'])) labels.add('SIP Daily');
      else if (keyMatch(`${type} ${frequency}`, ['monthly'])) labels.add('SIP Monthly');
      else labels.add('SIP');
    }
  }

  const preferredOrder = ['Lumpsum', 'SIP Monthly', 'SIP Daily', 'SIP', 'Redemption', 'Instant Redemption'];
  return [...preferredOrder.filter((label) => labels.has(label)), ...[...labels].filter((label) => !preferredOrder.includes(label))];
};

const itemFulfillments = (provider: OndcProvider, catalog: OndcCatalog, item: OndcItem): OndcFulfillment[] => {
  const ids = new Set([...(item.fulfillment_ids ?? []), item.fulfillment_id].filter(Boolean).map(String));
  const all = [...(catalog.fulfillments ?? []), ...(provider.fulfillments ?? [])];
  if (!ids.size) {
    return all;
  }

  return all.filter((fulfillment) => fulfillment.id && ids.has(fulfillment.id));
};

const compactId = (...values: Array<string | undefined>): string => values.filter(Boolean).join(':');

const fulfillmentType = (fulfillment: OndcFulfillment): string =>
  String(fulfillment.type || exactListValue(fulfillment.tags, ['type']) || '').toUpperCase();

const fulfillmentLabel = (fulfillment: OndcFulfillment): string => {
  const type = fulfillmentType(fulfillment);
  const frequency = exactListValue(fulfillment.tags, ['frequency']);
  const frequencyDayType = exactListValue(fulfillment.tags, ['frequency_day_type', 'frequency_type', 'frequency_dates']);

  if (type.includes('LUMPSUM')) return 'Lumpsum';
  if (type.includes('REDEMPTION') && type.includes('INSTANT')) return 'Instant Redemption';
  if (type.includes('REDEMPTION')) return 'Redemption';
  if (type.includes('SIP')) {
    if (keyMatch(`${type} ${frequency} ${frequencyDayType}`, ['daily'])) return 'SIP Daily';
    if (keyMatch(`${type} ${frequency}`, ['monthly'])) return 'SIP Monthly';
    return 'SIP';
  }

  return fulfillment.type || fulfillment.id || 'Fulfillment';
};

const buildFulfillmentDetails = (fulfillments: OndcFulfillment[]): ParsedFulfillmentDetails[] =>
  fulfillments.map((fulfillment) => {
    const frequency = exactListValue(fulfillment.tags, ['frequency']);
    const frequencyDayType = exactListValue(fulfillment.tags, ['frequency_day_type', 'frequency_type', 'frequency_dates']);

    return {
      id: fulfillment.id,
      type: fulfillment.type,
      label: fulfillmentLabel(fulfillment),
      frequency: displaySipFrequency(frequency, frequencyDayType),
      thresholds: fulfillmentThresholdValues(fulfillment.tags).map((threshold) => ({
        ...threshold,
        value: keyExactMatch(threshold.label, ['frequency']) ? displaySipFrequency(threshold.value, frequencyDayType) || threshold.value : threshold.value,
      })),
    };
  });

const extractLumpsumRules = (fulfillment?: OndcFulfillment): LumpsumRules | undefined => {
  if (!fulfillment) {
    return undefined;
  }

  const rules = {
    minimumAmount: exactListValue(fulfillment.tags, ['amount_min', 'min_amount', 'minimum_amount']),
    maximumAmount: exactListValue(fulfillment.tags, ['amount_max', 'max_amount', 'maximum_amount']),
    amountMultiples: exactListValue(fulfillment.tags, ['amount_multiples', 'amount_multiple', 'multiples']),
  };

  return Object.values(rules).some(Boolean) ? rules : undefined;
};

const extractSipRule = (fulfillment: OndcFulfillment): SipRule => ({
  id: fulfillment.id,
  type: fulfillment.type,
  frequency: displaySipFrequency(
    exactListValue(fulfillment.tags, ['frequency']),
    exactListValue(fulfillment.tags, ['frequency_day_type', 'frequency_type', 'frequency_dates']),
  ),
  frequencyDayType: exactListValue(fulfillment.tags, ['frequency_day_type', 'frequency_type', 'frequency_dates']),
  minAmount: exactListValue(fulfillment.tags, ['amount_min', 'min_amount', 'minimum_amount']),
  maxAmount: exactListValue(fulfillment.tags, ['amount_max', 'max_amount', 'maximum_amount']),
  installmentMin: exactListValue(fulfillment.tags, ['installment_min', 'installments_min', 'installment_count_min']),
  installmentMax: exactListValue(fulfillment.tags, ['installment_max', 'installments_max', 'installment_count_max']),
});

const extractRedemptionRules = (fulfillment?: OndcFulfillment): RedemptionRules | undefined => {
  if (!fulfillment) {
    return undefined;
  }

  const rules = {
    minUnits: exactListValue(fulfillment.tags, ['units_min', 'min_units', 'minimum_units']),
    maxUnits: exactListValue(fulfillment.tags, ['units_max', 'max_units', 'maximum_units']),
  };

  return Object.values(rules).some(Boolean) ? rules : undefined;
};

const buildSchemeRules = (fulfillments: OndcFulfillment[]): SchemeRules => {
  const lumpsum = fulfillments.find((fulfillment) => fulfillmentType(fulfillment).includes('LUMPSUM'));
  const sip = fulfillments.filter((fulfillment) => fulfillmentType(fulfillment).includes('SIP')).map(extractSipRule);
  const redemption = fulfillments.find((fulfillment) => {
    const type = fulfillmentType(fulfillment);
    return type.includes('REDEMPTION') && !type.includes('INSTANT');
  });
  const instantRedemption = fulfillments.find((fulfillment) => {
    const type = fulfillmentType(fulfillment);
    return type.includes('REDEMPTION') && type.includes('INSTANT');
  });

  return {
    lumpsum: extractLumpsumRules(lumpsum),
    sip,
    redemption: extractRedemptionRules(redemption),
    instantRedemption: extractRedemptionRules(instantRedemption),
  };
};

export const parseOnSearchCatalog = (payload: OndcOnSearchPayload): ParsedCatalog => {
  const catalog = payload.message?.catalog;
  if (!catalog || !Array.isArray(catalog.providers)) {
    throw new Error('Malformed on_search payload: message.catalog.providers is missing.');
  }

  const providers = catalog.providers;
  const bppId = payload.context?.bpp_id === undefined ? undefined : String(payload.context.bpp_id);
  const bppUri = payload.context?.bpp_uri === undefined ? undefined : String(payload.context.bpp_uri);
  const catalogCategories = catalog.categories ?? [];
  const catalogFulfillments = catalog.fulfillments ?? [];
  const schemes: ParsedScheme[] = [];

  for (const provider of providers) {
    const categories = providerCategories(catalog, provider);
    const items = provider.items ?? [];
    const itemById = new Map(items.filter((item) => item.id).map((item) => [item.id as string, item]));
    for (const item of items) {
      if (item.descriptor?.code !== 'SCHEME_PLAN') {
        continue;
      }

      const parentItem = item.parent_item_id ? itemById.get(item.parent_item_id) : undefined;
      const fulfillments = itemFulfillments(provider, catalog, item);
      const itemTags = item.tags ?? [];
      const fulfillmentTags = fulfillments.flatMap((fulfillment) => fulfillment.tags ?? []);
      const categoryId = item.category_id || parentItem?.category_id;
      const categoryHierarchy = buildCategoryPath(categories, categoryId);
      const plan = groupedListValue(itemTags, ['plan_options'], ['plan']) || exactListValue(itemTags, ['plan', 'plan_type']);
      const option = groupedListValue(itemTags, ['plan_options'], ['option']) || exactListValue(itemTags, ['option']);
      const idcwOption = groupedListValue(itemTags, ['plan_options'], ['idcw_option']) || exactListValue(itemTags, ['idcw']);
      const identifiers = {
        isin: listValue(itemTags, ['isin']),
        rta: listValue(itemTags, ['rta', 'rta_identifier']),
        amfi: listValue(itemTags, ['amfi', 'amfi_identifier']),
      };
      const schemeName = descriptorText(item.descriptor) || item.id || 'Unnamed Scheme';

      schemes.push({
        id: compactId(provider.id, item.id),
        name: schemeName,
        amcName: descriptorText(item.creator?.descriptor) || listValue(itemTags, ['amc', 'amc_name']),
        providerId: provider.id || '',
        providerName: descriptorText(provider.descriptor) || provider.id || 'Unknown Provider',
        bppId,
        bppUri,
        schemeId: listValue(itemTags, ['scheme_id']) || parentItem?.id || item.id,
        schemeItemId: listValue(itemTags, ['scheme_item_id']) || parentItem?.id || item.id,
        itemId: item.id || '',
        planId: listValue(itemTags, ['plan_id']),
        categoryId,
        categoryHierarchy,
        categoryPath: categoryHierarchy.join(' > '),
        identifiers,
        plan,
        option,
        idcwOption,
        status: listValue(itemTags, ['status']),
        lockInPeriod: listValue(itemTags, ['lock_in', 'lockin']),
        entryLoad: listValue(itemTags, ['entry_load']),
        exitLoad: listValue(itemTags, ['exit_load']),
        nfo: {
          startDate: listValue(itemTags, ['nfo_start']),
          endDate: listValue(itemTags, ['nfo_end']),
          allotmentDate: listValue(itemTags, ['nfo_allotment']),
          reopenDate: listValue(itemTags, ['nfo_reopen']),
        },
        documents: {
          consumerTermsUrl: groupedListValue(itemTags, ['plan_information'], ['consumer_tnc', 'consumer_t_c', 'consumer_terms']),
          offerDocumentUrl:
            groupedListValue(itemTags, ['plan_information', 'scheme_information', 'documents'], [
              'offer_document',
              'offer_document_url',
              'offer_doc',
              'offer_doc_url',
              'scheme_document',
              'scheme_document_url',
            ]) || exactListValue(itemTags, ['offer_document', 'offer_document_url', 'offer_doc', 'offer_doc_url', 'scheme_document']),
        },
        rules: buildSchemeRules(fulfillments),
        fulfillmentIds: fulfillments.map((fulfillment) => fulfillment.id).filter(Boolean) as string[],
        fulfillmentTypes: fulfillments.map((fulfillment) => String(fulfillment.type ?? '-')),
        fulfillmentDetails: buildFulfillmentDetails(fulfillments),
        transactionChips: supportedTransactionChips(fulfillments),
        thresholds: [...thresholdValues(itemTags), ...thresholdValues(fulfillmentTags)],
        rawProvider: provider,
        rawItem: item,
        rawFulfillments: fulfillments,
        rawCategories: categories,
      });
    }
  }

  return {
    providers,
    categories: [...catalogCategories, ...providers.flatMap((provider) => provider.categories ?? [])],
    fulfillments: [...catalogFulfillments, ...providers.flatMap((provider) => provider.fulfillments ?? [])],
    schemes,
    rawPayload: payload,
  };
};
