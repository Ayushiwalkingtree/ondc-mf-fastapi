export type InvestorFormFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'textarea'
  | 'hidden';

export interface InvestorFormOption {
  label: string;
  value: string;
}

export interface InvestorFormField {
  id?: string;
  name: string;
  label: string;
  type: InvestorFormFieldType;
  required: boolean;
  value?: string;
  placeholder?: string;
  section: string;
  options?: InvestorFormOption[];
}

export interface ParsedInvestorForm {
  action: string;
  method: string;
  fields: InvestorFormField[];
  rawHtml: string;
}

export interface InvestorFormSubmitResponse {
  success?: boolean;
  submission_id?: string;
  submissionId?: string;
  [key: string]: unknown;
}

const supportedInputTypes = new Set([
  'text',
  'number',
  'email',
  'date',
  'radio',
  'checkbox',
  'hidden',
  'tel',
  'url',
  'password',
]);

const sectionRules: Array<[RegExp, string]> = [
  [/(name|dob|birth|gender|marital)/i, 'Personal Details'],
  [/(pan|kyc|occupation|wealth|income)/i, 'KYC Details'],
  [/(tax|residen|country|fatca)/i, 'Tax Residency'],
  [/(bank|ifsc|account|upi|mandate)/i, 'Bank Details'],
  [/(nominee|guardian)/i, 'Nominee Details'],
];

export const fetchInvestorForm = async (formUrl: string): Promise<string> => {
  const response = await fetch(resolveBrowserRequestUrl(formUrl), {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch investor form. HTTP ${response.status}`);
  }

  return response.text();
};

export const parseInvestorFormHtml = (html: string, sourceUrl: string): ParsedInvestorForm => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const form = document.querySelector('form');

  if (!form) {
    throw new Error('Investor form HTML does not contain a form element.');
  }

  const actionAttribute = form.getAttribute('action')?.trim();
  const action = actionAttribute ? new URL(actionAttribute, sourceUrl).toString() : sourceUrl;
  const method = (form.getAttribute('method') || 'POST').toUpperCase();
  const controls = Array.from(form.querySelectorAll('input, select, textarea'));
  const fields = mergeChoiceGroups(
    controls
      .map((control) => parseControl(control, document))
      .filter((field): field is InvestorFormField => Boolean(field)),
  );

  if (!fields.length) {
    throw new Error('Investor form HTML did not expose any supported fields.');
  }

  return {
    action,
    method,
    fields,
    rawHtml: html,
  };
};

export const submitInvestorForm = async (
  parsedForm: ParsedInvestorForm,
  values: Record<string, unknown>,
): Promise<InvestorFormSubmitResponse> => {
  const body = new URLSearchParams();

  parsedForm.fields.forEach((field) => {
    const rawValue = values[field.name];
    if (field.type === 'checkbox') {
      if (Array.isArray(rawValue)) {
        rawValue.forEach((entry) => body.append(field.name, String(entry)));
      } else if (rawValue === true) {
        body.append(field.name, field.value || 'on');
      } else if (typeof rawValue === 'string' && rawValue) {
        body.append(field.name, rawValue);
      }
      return;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((entry) => body.append(field.name, String(entry)));
      return;
    }

    if (rawValue !== undefined && rawValue !== null) {
      body.append(field.name, String(rawValue));
    }
  });

  const response = await fetch(resolveBrowserRequestUrl(parsedForm.action), {
    method: parsedForm.method || 'POST',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Investor form submission failed. HTTP ${response.status}`);
  }

  return parseFormSubmitResponse(text);
};

export const resolveBrowserRequestUrl = (value: string): string => {
  if (!isLocalHost(window.location.hostname)) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.hostname === 'workbench.ondc.tech' && url.pathname.startsWith('/form-service/')) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }

  return value;
};

const parseControl = (control: Element, document: Document): InvestorFormField | undefined => {
  const tag = control.tagName.toLowerCase();
  const name = control.getAttribute('name')?.trim();
  if (!name) {
    return undefined;
  }

  if (tag === 'input') {
    const input = control as HTMLInputElement;
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (!supportedInputTypes.has(type) || ['submit', 'button', 'reset', 'image', 'file'].includes(type)) {
      return undefined;
    }

    const normalizedType = normalizeInputType(type);
    return {
      id: input.id || undefined,
      name,
      label: labelFor(control, document),
      type: normalizedType,
      required: input.required || input.getAttribute('aria-required') === 'true',
      value: input.value || input.getAttribute('value') || undefined,
      placeholder: input.placeholder || undefined,
      section: sectionFor(control, name),
      options:
        normalizedType === 'radio' || normalizedType === 'checkbox'
          ? [{ label: labelFor(control, document), value: input.value || 'on' }]
          : undefined,
    };
  }

  if (tag === 'select') {
    const select = control as HTMLSelectElement;
    return {
      id: select.id || undefined,
      name,
      label: labelFor(control, document),
      type: 'select',
      required: select.required || select.getAttribute('aria-required') === 'true',
      value: select.value || undefined,
      section: sectionFor(control, name),
      options: Array.from(select.options).map((option) => ({
        label: option.textContent?.trim() || option.value,
        value: option.value,
      })),
    };
  }

  if (tag === 'textarea') {
    const textarea = control as HTMLTextAreaElement;
    return {
      id: textarea.id || undefined,
      name,
      label: labelFor(control, document),
      type: 'textarea',
      required: textarea.required || textarea.getAttribute('aria-required') === 'true',
      value: textarea.value || undefined,
      placeholder: textarea.placeholder || undefined,
      section: sectionFor(control, name),
    };
  }

  return undefined;
};

const mergeChoiceGroups = (fields: InvestorFormField[]): InvestorFormField[] => {
  const merged: InvestorFormField[] = [];
  const choiceIndexes = new Map<string, number>();

  fields.forEach((field) => {
    if (field.type !== 'radio' && field.type !== 'checkbox') {
      merged.push(field);
      return;
    }

    const groupKey = `${field.type}:${field.name}`;
    const existingIndex = choiceIndexes.get(groupKey);
    if (existingIndex === undefined) {
      choiceIndexes.set(groupKey, merged.length);
      merged.push({ ...field, options: field.options ?? [] });
      return;
    }

    const existing = merged[existingIndex];
    existing.required = existing.required || field.required;
    existing.options = [...(existing.options ?? []), ...(field.options ?? [])];
  });

  return merged;
};

const normalizeInputType = (type: string): InvestorFormFieldType => {
  if (type === 'tel' || type === 'url' || type === 'password') {
    return 'text';
  }
  return type as InvestorFormFieldType;
};

const labelFor = (control: Element, document: Document): string => {
  const id = control.getAttribute('id');
  const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : undefined;
  if (explicit) return cleanLabel(explicit);

  const wrapping = control.closest('label')?.textContent?.trim();
  if (wrapping) return cleanLabel(wrapping);

  const aria = control.getAttribute('aria-label')?.trim();
  if (aria) return cleanLabel(aria);

  const placeholder = control.getAttribute('placeholder')?.trim();
  if (placeholder) return cleanLabel(placeholder);

  return humanize(control.getAttribute('name') || 'Field');
};

const sectionFor = (control: Element, name: string): string => {
  const legend = control.closest('fieldset')?.querySelector('legend')?.textContent?.trim();
  if (legend) return cleanLabel(legend);

  const haystack = `${name} ${control.getAttribute('id') ?? ''} ${control.getAttribute('placeholder') ?? ''}`;
  const matched = sectionRules.find(([pattern]) => pattern.test(haystack));
  return matched?.[1] ?? 'Additional Details';
};

const cleanLabel = (value: string): string => value.replace(/\s+/g, ' ').replace(/\*+$/, '').trim();

const humanize = (value: string): string =>
  value
    .replace(/\[\]$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parseFormSubmitResponse = (text: string): InvestorFormSubmitResponse => {
  try {
    const parsed = JSON.parse(text) as InvestorFormSubmitResponse;
    return normalizeSubmissionResponse(parsed);
  } catch {
    const submissionMatch = text.match(/submission[_-]?id["'\s:=]+([a-zA-Z0-9_-]+)/i);
    if (submissionMatch?.[1]) {
      return { success: true, submission_id: submissionMatch[1] };
    }
    return { success: false, raw: text };
  }
};

const normalizeSubmissionResponse = (response: InvestorFormSubmitResponse): InvestorFormSubmitResponse => {
  const submissionId = response.submission_id ?? response.submissionId;
  return submissionId ? { ...response, success: response.success ?? true, submission_id: String(submissionId) } : response;
};

const isLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
