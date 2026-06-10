import type {
  OndcCatalog,
  OndcCategory,
  OndcFulfillment,
  OndcItem,
  OndcOnSearchPayload,
  OndcProvider,
  OndcTag,
  ParsedCatalog,
  ParsedScheme,
  ThresholdValue,
} from '../types/scheme';

const keyMatch = (value: unknown, patterns: string[]): boolean => {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return patterns.some((pattern) => normalized.includes(pattern));
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

const allTagValues = (tags: OndcTag[] | undefined): ThresholdValue[] =>
  (tags ?? []).flatMap((tag) =>
    (tag.list ?? []).map((item) => ({
      label: descriptorText(item.descriptor) || descriptorText(tag.descriptor) || 'Value',
      value: item.value === undefined ? '-' : String(item.value),
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

  return path.filter(Boolean);
};

const supportedTransactionChips = (fulfillments: OndcFulfillment[]): string[] => {
  const labels = new Set<string>();
  for (const fulfillment of fulfillments) {
    const type = String(fulfillment.type || listValue(fulfillment.tags, ['type']) || '').toUpperCase();
    const frequency = listValue(fulfillment.tags, ['frequency']) || '';
    const frequencyType = listValue(fulfillment.tags, ['frequency_type', 'frequency_dates']) || '';

    if (type.includes('LUMPSUM')) labels.add('LUMPSUM');
    if (type.includes('REDEMPTION') && type.includes('INSTANT')) labels.add('INSTANT REDEMPTION');
    else if (type.includes('REDEMPTION')) labels.add('REDEMPTION');
    if (type.includes('SIP')) {
      if (keyMatch(`${frequency} ${frequencyType}`, ['daily_business'])) labels.add('SIP Daily Business');
      else if (keyMatch(`${frequency} ${frequencyType}`, ['daily_calendar'])) labels.add('SIP Daily Calendar');
      else if (keyMatch(frequency, ['monthly'])) labels.add('SIP Monthly');
      else labels.add('SIP');
    }
  }

  return [...labels];
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

export const parseOnSearchCatalog = (payload: OndcOnSearchPayload): ParsedCatalog => {
  const catalog = payload.message?.catalog;
  if (!catalog || !Array.isArray(catalog.providers)) {
    throw new Error('Malformed on_search payload: message.catalog.providers is missing.');
  }

  const providers = catalog.providers;
  const catalogCategories = catalog.categories ?? [];
  const catalogFulfillments = catalog.fulfillments ?? [];
  const schemes: ParsedScheme[] = [];

  for (const provider of providers) {
    const categories = providerCategories(catalog, provider);
    for (const item of provider.items ?? []) {
      const fulfillments = itemFulfillments(provider, catalog, item);
      const itemTags = item.tags ?? [];
      const fulfillmentTags = fulfillments.flatMap((fulfillment) => fulfillment.tags ?? []);
      const categoryHierarchy = buildCategoryPath(categories, item.category_id);
      const identifiers = {
        isin: listValue(itemTags, ['isin']),
        rta: listValue(itemTags, ['rta', 'rta_identifier']),
        amfi: listValue(itemTags, ['amfi', 'amfi_identifier']),
      };
      const schemeName = descriptorText(item.descriptor) || item.id || 'Unnamed Scheme';

      schemes.push({
        id: compactId(provider.id, item.id),
        name: schemeName,
        amcName: listValue(itemTags, ['amc', 'amc_name']) || provider.descriptor?.name,
        providerId: provider.id || '',
        providerName: descriptorText(provider.descriptor) || provider.id || 'Unknown Provider',
        schemeId: listValue(itemTags, ['scheme_id']) || item.id,
        schemeItemId: listValue(itemTags, ['scheme_item_id']) || item.id,
        itemId: item.id || '',
        planId: listValue(itemTags, ['plan_id']),
        categoryId: item.category_id,
        categoryHierarchy,
        categoryPath: categoryHierarchy.join(' > ') || item.category_id || '-',
        identifiers,
        plan: listValue(itemTags, ['plan', 'plan_type']),
        option: listValue(itemTags, ['option']),
        idcwOption: listValue(itemTags, ['idcw']),
        status: listValue(itemTags, ['status']),
        lockInPeriod: listValue(itemTags, ['lock_in', 'lockin']),
        exitLoad: listValue(itemTags, ['exit_load']),
        nfo: {
          startDate: listValue(itemTags, ['nfo_start']),
          endDate: listValue(itemTags, ['nfo_end']),
          allotmentDate: listValue(itemTags, ['nfo_allotment']),
          reopenDate: listValue(itemTags, ['nfo_reopen']),
        },
        documents: {
          consumerTermsUrl: listValue(itemTags, ['consumer_t_c', 'consumer_terms', 'terms']),
          offerDocumentUrl: listValue(itemTags, ['offer_document', 'scheme_document', 'document']),
        },
        fulfillmentIds: fulfillments.map((fulfillment) => fulfillment.id).filter(Boolean) as string[],
        fulfillmentTypes: fulfillments.map((fulfillment) => String(fulfillment.type ?? '-')),
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
