import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import FormField, { type FieldOption } from '../../components/FormField/FormField';
import { confirmOrder } from '../../services/confirm.service';
import { initOrder } from '../../services/init.service';
import { ondcSocketService } from '../../services/ondcSocket.service';
import { selectScheme } from '../../services/select.service';
import { getOrderStatus } from '../../services/status.service';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import type { InvestorFormResponse, WorkbenchSession } from '../../store/mfJourneyStore';
import type { OndcRealtimeEvent } from '../../types/ondc';
import type { ParsedScheme, RedemptionRules } from '../../types/scheme';
import type { TransactionDetails } from '../../types/transaction';
import { amountToWords } from '../../utils/formatters';
import styles from '../page.module.scss';
import InvestorDetailsReactForm from './InvestorDetailsReactForm';
import detailStyles from './TransactionSetup.module.scss';

type InvestmentType = 'LUMPSUM' | 'SIP';
type InvestorFormMode = 'native' | 'iframe';
type WizardStepId =
  | 'search'
  | 'select'
  | 'onSelect'
  | 'investorForm'
  | 'secondSelect'
  | 'secondOnSelect'
  | 'init'
  | 'onInit'
  | 'confirm'
  | 'onConfirm'
  | 'payment'
  | 'status'
  | 'onUpdate';

const wizardSteps: Array<{ id: WizardStepId; label: string; description: string }> = [
  { id: 'onSelect', label: 'On Select', description: 'Initial quote and investor form.' },
  { id: 'investorForm', label: 'Investor Form', description: 'Investor details submission.' },
  { id: 'secondSelect', label: 'Second Select', description: 'Submit form ID with original transaction.' },
  { id: 'secondOnSelect', label: 'Second On Select', description: 'Final quote before init.' },
  { id: 'init', label: 'Init', description: 'Order initialization request.' },
  { id: 'onInit', label: 'On Init', description: 'Initialized order response.' },
  { id: 'confirm', label: 'Confirm', description: 'Investment order confirmation.' },
  { id: 'onConfirm', label: 'On Confirm', description: 'Order acceptance and payment details.' },
  { id: 'payment', label: 'Payment', description: 'Complete payment authorization.' },
  { id: 'status', label: 'Status', description: 'Order status request.' },
  { id: 'onUpdate', label: 'On Update', description: 'Realtime order update timeline.' },
];

interface TransactionSetupForm {
  investmentType: InvestmentType;
  amount: number;
  pan: string;
  arn: string;
  euin: string;
  subBrokerArn: string;
  submissionId: string;
}

const valueOrDash = (value?: string) => (value && value.trim() ? value : '-');

const DetailRow = ({ label, value }: { label: string; value?: string }) => (
  <div className={detailStyles.detailRow}>
    <span>{label}</span>
    <strong>{valueOrDash(value)}</strong>
  </div>
);

const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={detailStyles.detailSection}>
    <h4>{title}</h4>
    {children}
  </section>
);

const RedemptionRows = ({ rules }: { rules?: RedemptionRules }) => (
  <div className={detailStyles.detailGrid}>
    <DetailRow label="Min Units" value={rules?.minUnits} />
    <DetailRow label="Max Units" value={rules?.maxUnits} />
  </div>
);

const SchemeDetails = ({ scheme, onChangeScheme }: { scheme: ParsedScheme; onChangeScheme: () => void }) => (
  <div className={detailStyles.schemeDetails}>
    <div className={detailStyles.schemeHeader}>
      <div>
        <p>Selected Scheme</p>
        <h3>{scheme.name}</h3>
      </div>
      <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onChangeScheme}>
        Change Scheme
      </Button>
    </div>

    <DetailSection title="Overview">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Scheme Name" value={scheme.name} />
        <DetailRow label="AMC Name" value={scheme.amcName || scheme.providerName} />
        <DetailRow label="Category" value={scheme.categoryPath} />
        <DetailRow label="Plan" value={scheme.plan} />
        <DetailRow label="Option" value={scheme.option} />
        <DetailRow label="IDCW Option" value={scheme.idcwOption} />
      </div>
    </DetailSection>

    <DetailSection title="Identifiers">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="ISIN" value={scheme.identifiers.isin} />
        <DetailRow label="AMFI Identifier" value={scheme.identifiers.amfi} />
        <DetailRow label="RTA Identifier" value={scheme.identifiers.rta} />
      </div>
    </DetailSection>

    <DetailSection title="Lumpsum Rules">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Minimum Amount" value={scheme.rules.lumpsum?.minimumAmount} />
        <DetailRow label="Maximum Amount" value={scheme.rules.lumpsum?.maximumAmount} />
        <DetailRow label="Amount Multiples" value={scheme.rules.lumpsum?.amountMultiples} />
      </div>
    </DetailSection>

    <DetailSection title="SIP Rules">
      {scheme.rules.sip.length ? (
        <div className={detailStyles.ruleList}>
          {scheme.rules.sip.map((rule, index) => (
            <div className={detailStyles.ruleBlock} key={rule.id || `${rule.type}-${index}`}>
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Frequency" value={rule.frequency} />
                <DetailRow label="Frequency Day Type" value={rule.frequencyDayType} />
                <DetailRow label="Min Amount" value={rule.minAmount} />
                <DetailRow label="Max Amount" value={rule.maxAmount} />
                <DetailRow label="Installment Min" value={rule.installmentMin} />
                <DetailRow label="Installment Max" value={rule.installmentMax} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={detailStyles.emptyState}>SIP rules unavailable.</p>
      )}
    </DetailSection>

    <DetailSection title="Redemption Rules">
      <RedemptionRows rules={scheme.rules.redemption} />
      {scheme.rules.instantRedemption ? (
        <div className={detailStyles.subSection}>
          <h5>Instant Redemption</h5>
          <RedemptionRows rules={scheme.rules.instantRedemption} />
        </div>
      ) : null}
    </DetailSection>

    <DetailSection title="Documents">
      <div className={detailStyles.documentLinks}>
        {scheme.documents.consumerTermsUrl ? (
          <Link href={scheme.documents.consumerTermsUrl} target="_blank" rel="noreferrer">
            Consumer T&amp;C
          </Link>
        ) : (
          <span>Consumer T&amp;C unavailable</span>
        )}
        {scheme.documents.offerDocumentUrl ? (
          <Link href={scheme.documents.offerDocumentUrl} target="_blank" rel="noreferrer">
            Offer Document
          </Link>
        ) : (
          <span>Offer Document unavailable</span>
        )}
      </div>
    </DetailSection>
  </div>
);

const supportsFulfillmentType = (scheme: ParsedScheme, type: InvestmentType): boolean =>
  scheme.fulfillmentDetails.some((fulfillment) =>
    `${fulfillment.type ?? ''} ${fulfillment.label}`.toUpperCase().includes(type),
  );

const investmentOptionsForScheme = (scheme?: ParsedScheme): FieldOption[] => {
  if (!scheme) {
    return [];
  }

  return [
    supportsFulfillmentType(scheme, 'LUMPSUM') ? { label: 'Lumpsum', value: 'LUMPSUM' } : undefined,
    supportsFulfillmentType(scheme, 'SIP') ? { label: 'SIP', value: 'SIP' } : undefined,
  ].filter(Boolean) as FieldOption[];
};

const fulfillmentIdForType = (scheme: ParsedScheme, type: InvestmentType): string | undefined =>
  scheme.fulfillmentDetails.find((fulfillment) =>
    `${fulfillment.type ?? ''} ${fulfillment.label}`.toUpperCase().includes(type),
  )?.id ?? scheme.fulfillmentIds[0];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const getOrder = (payload: unknown): Record<string, unknown> => {
  const message = isRecord(payload) && isRecord(payload.message) ? payload.message : undefined;
  return message && isRecord(message.order) ? message.order : {};
};

const firstRecord = (value: unknown): Record<string, unknown> =>
  Array.isArray(value) && isRecord(value[0]) ? value[0] : {};

const getQuote = (payload: unknown): Record<string, unknown> => {
  const quote = getOrder(payload).quote;
  return isRecord(quote) ? quote : {};
};

const getQuotePrice = (payload: unknown): Record<string, unknown> => {
  const price = getQuote(payload).price;
  return isRecord(price) ? price : {};
};

const stringValue = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

const descriptorName = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const descriptor = isRecord(value.descriptor) ? value.descriptor : undefined;
  return descriptor?.name === undefined ? undefined : String(descriptor.name);
};

const extractOrderId = (payload: unknown): string | undefined => stringValue(getOrder(payload).id);

const extractProviderId = (payload: unknown): string | undefined => {
  const provider = getOrder(payload).provider;
  const providerId = isRecord(provider) ? stringValue(provider.id) : undefined;
  return providerId?.trim() ? providerId : undefined;
};

const extractPayment = (payload: unknown): Record<string, unknown> => firstRecord(getOrder(payload).payments);

const extractPaymentId = (payload: unknown): string | undefined => stringValue(extractPayment(payload).id);

const findValueByKey = (value: unknown, matcher: (key: string, entry: unknown) => boolean): unknown => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findValueByKey(entry, matcher);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (!isRecord(value)) return undefined;

  for (const [key, entry] of Object.entries(value)) {
    if (matcher(key, entry)) return entry;
    const found = findValueByKey(entry, matcher);
    if (found !== undefined) return found;
  }

  return undefined;
};

const findPaymentUrl = (payload: unknown): string | undefined => {
  const direct = findValueByKey(payload, (key, entry) => {
    const normalized = key.toLowerCase();
    return typeof entry === 'string' && /^https?:\/\//.test(entry) && normalized.includes('url');
  });
  if (typeof direct === 'string') return direct;

  const fallback = findValueByKey(payload, (_key, entry) =>
    typeof entry === 'string' && /^https?:\/\//.test(entry) && entry.toLowerCase().includes('payment'),
  );
  return typeof fallback === 'string' ? fallback : undefined;
};

const extractApiError = (error: unknown): string => {
  if (isRecord(error) && isRecord(error.response)) {
    const response = error.response;
    const status = stringValue(response.status);
    const data = response.data;
    const message =
      isRecord(data) && data.detail !== undefined
        ? stringValue(data.detail)
        : error.message !== undefined
          ? stringValue(error.message)
          : 'API request failed.';
    return [
      'Endpoint: ONDC API',
      status ? `HTTP Code: ${status}` : undefined,
      `Error Message: ${message}`,
      data !== undefined ? `Raw Response: ${stringify(data)}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return error instanceof Error ? error.message : 'Unable to complete ONDC transaction flow.';
};

const stringify = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
};

const findForm = (payload: unknown): { id?: string; url?: string } => {
  const visit = (value: unknown): { id?: string; url?: string } | undefined => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = visit(entry);
        if (found?.url) return found;
      }
      return undefined;
    }

    if (!isRecord(value)) return undefined;

    const xinput = isRecord(value.xinput) ? value.xinput : undefined;
    const form = xinput && isRecord(xinput.form) ? xinput.form : undefined;
    if (form?.url !== undefined) {
      return {
        id: form.id === undefined ? undefined : String(form.id),
        url: String(form.url),
      };
    }

    for (const nested of Object.values(value)) {
      const found = visit(nested);
      if (found?.url) return found;
    }

    return undefined;
  };

  return visit(payload) ?? {};
};

const extractWorkbenchSession = (payload: unknown): WorkbenchSession => {
  const form = findForm(payload);
  if (!form.url) {
    return {};
  }

  try {
    const url = new URL(form.url);
    return {
      sessionId: url.searchParams.get('session_id') ?? undefined,
      flowId: url.searchParams.get('flow_id') ?? undefined,
      transactionId: url.searchParams.get('transaction_id') ?? undefined,
    };
  } catch {
    return {};
  }
};

const parseMessageData = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    const jsonStart = value.indexOf('{');
    const jsonEnd = value.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(value.slice(jsonStart, jsonEnd + 1)) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  }
};

const extractInvestorFormResponse = (value: unknown): InvestorFormResponse | undefined => {
  const parsed = parseMessageData(value);
  if (!isRecord(parsed)) return undefined;
  const direct = parsed.submission_id ?? parsed.submissionId;
  if (parsed.success === true && direct !== undefined) {
    return { ...parsed, success: true, submission_id: String(direct) };
  }
  const formResponse = isRecord(parsed.form_response) ? parsed.form_response : undefined;
  const nested = formResponse?.submission_id;
  if (parsed.success === true && nested !== undefined) {
    return { ...parsed, success: true, submission_id: String(nested) };
  }
  return undefined;
};

const extractInvestorFormResponseFromUrl = (value?: string): InvestorFormResponse | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const submissionId = url.searchParams.get('submission_id') ?? url.searchParams.get('submissionId');
    const success = url.searchParams.get('success');
    if (submissionId && success === 'true') {
      return { success: true, submission_id: submissionId };
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const iframeFormUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
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

const OnSelectResponse = ({
  developerMode = false,
  payload,
  scheme,
  title,
}: {
  developerMode?: boolean;
  payload?: unknown;
  scheme?: ParsedScheme;
  title: string;
}) => {
  if (!payload) {
    return null;
  }

  const order = getOrder(payload);
  const provider = isRecord(order.provider) ? order.provider : {};
  const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const quote = order.quote;
  const applicationForm = findForm(payload);
  const thresholds = fulfillments.flatMap((fulfillment) =>
    isRecord(fulfillment) && Array.isArray(fulfillment.tags)
      ? fulfillment.tags.filter((tag) => isRecord(tag) && JSON.stringify(tag).toLowerCase().includes('threshold'))
      : [],
  );

  return (
    <DetailSection title={title}>
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Provider" value={descriptorName(provider) || stringify(provider.id)} />
        <DetailRow label="Fulfillments" value={stringify(fulfillments)} />
        <DetailRow label="Thresholds" value={stringify(thresholds)} />
        <DetailRow label="Payment Methods" value={stringify(payments)} />
        <DetailRow label="Quote" value={stringify(quote)} />
        <DetailRow label="Scheme Details" value={scheme ? `${scheme.name}${scheme.amcName ? `\n${scheme.amcName}` : ''}` : undefined} />
        <DetailRow label="Application Form ID" value={applicationForm.id} />
      </div>
      {developerMode ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Raw JSON</AccordionSummary>
          <AccordionDetails>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </DetailSection>
  );
};

const SecondOnSelectResponse = ({
  developerMode = false,
  payload,
  scheme,
}: {
  developerMode?: boolean;
  payload?: unknown;
  scheme?: ParsedScheme;
}) => {
  if (!payload) {
    return null;
  }

  const order = getOrder(payload);
  const provider = isRecord(order.provider) ? order.provider : {};
  const item = firstRecord(order.items);
  const fulfillment = firstRecord(order.fulfillments);
  const quote = getQuote(payload);
  const price = getQuotePrice(payload);
  const payment = extractPayment(payload);

  return (
    <DetailSection title="Second on_select Response">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Provider" value={descriptorName(provider) || stringValue(provider.id)} />
        <DetailRow label="Item" value={stringify(item)} />
        <DetailRow label="Fulfillment" value={stringify(fulfillment)} />
        <DetailRow label="Quote" value={stringify(quote)} />
        <DetailRow label="Breakup" value={stringify(quote.breakup)} />
        <DetailRow label="Charges" value={stringify(order.charges ?? payment.params ?? payment)} />
        <DetailRow label="NAV Applicability" value={stringValue(order.nav_applicability ?? quote.nav_applicability)} />
        <DetailRow label="Amount" value={stringValue(price.value ?? order.amount)} />
        <DetailRow label="Currency" value={stringValue(price.currency)} />
        <DetailRow label="Payment Requirements" value={stringify(order.payments ?? payment)} />
        <DetailRow label="Scheme Details" value={scheme ? `${scheme.name}${scheme.amcName ? `\n${scheme.amcName}` : ''}` : undefined} />
      </div>
      {developerMode ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Raw JSON</AccordionSummary>
          <AccordionDetails>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </DetailSection>
  );
};

const OnInitResponse = ({ developerMode = false, payload }: { developerMode?: boolean; payload?: unknown }) => {
  if (!payload) {
    return null;
  }

  const order = getOrder(payload);
  const provider = isRecord(order.provider) ? order.provider : {};
  const item = firstRecord(order.items);
  const fulfillment = firstRecord(order.fulfillments);
  const payments = Array.isArray(order.payments) ? order.payments : [];

  return (
    <DetailSection title="on_init Response">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Order ID" value={stringValue(order.id)} />
        <DetailRow label="Provider" value={descriptorName(provider) || stringValue(provider.id)} />
        <DetailRow label="Item" value={stringify(item)} />
        <DetailRow label="Quote" value={stringify(order.quote)} />
        <DetailRow label="Breakup" value={stringify(getQuote(payload).breakup)} />
        <DetailRow label="Fulfillment" value={stringify(fulfillment)} />
        <DetailRow label="Payment Details" value={stringify(payments)} />
        <DetailRow label="Customer Details" value={stringify(order.billing ?? order.customer)} />
        <DetailRow label="Settlement Info" value={stringify(order.settlement ?? order.tags)} />
        <DetailRow label="Status" value={stringify(order.status ?? order.state)} />
      </div>
      {developerMode ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Raw JSON</AccordionSummary>
          <AccordionDetails>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </DetailSection>
  );
};

const OnConfirmResponse = ({ developerMode = false, payload }: { developerMode?: boolean; payload?: unknown }) => {
  if (!payload) {
    return null;
  }

  const order = getOrder(payload);
  const payment = extractPayment(payload);
  const paymentUrl = findPaymentUrl(payload);

  return (
    <DetailSection title="on_confirm Response">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Order ID" value={stringValue(order.id)} />
        <DetailRow label="State" value={stringValue(order.state ?? order.status)} />
        <DetailRow label="Quote" value={stringify(order.quote)} />
        <DetailRow label="Payment Object" value={stringify(payment)} />
        <DetailRow label="Payment URL" value={paymentUrl} />
        <DetailRow label="Payment Status" value={stringValue(payment.status)} />
      </div>
      {developerMode ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Raw JSON</AccordionSummary>
          <AccordionDetails>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </DetailSection>
  );
};

const PaymentSection = ({
  onCompleted,
  paymentUrl,
}: {
  onCompleted: () => void;
  paymentUrl?: string;
}) => {
  if (!paymentUrl) {
    return null;
  }

  return (
    <DetailSection title="Complete Payment">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Payment Status" value="Pending" />
        <DetailRow label="Payment URL" value={paymentUrl} />
      </div>
      <iframe
        src={paymentUrl}
        title="Payment"
        style={{ width: '100%', minHeight: 520, border: 0, borderRadius: 8 }}
      />
      <div className={styles.actions}>
        <Button variant="outlined" href={paymentUrl} target="_blank" rel="noreferrer">
          Open Payment
        </Button>
        <Button variant="contained" onClick={onCompleted}>
          I Have Completed Payment
        </Button>
      </div>
    </DetailSection>
  );
};

const OnStatusResponse = ({
  developerMode = false,
  investorName,
  payload,
  schemeName,
}: {
  developerMode?: boolean;
  investorName?: string;
  payload?: unknown;
  schemeName?: string;
}) => {
  if (!payload) {
    return null;
  }

  const order = getOrder(payload);
  const payment = extractPayment(payload);
  const fulfillment = firstRecord(order.fulfillments);
  const price = getQuotePrice(payload);
  const state = stringValue(order.state ?? order.status ?? payment.status ?? 'Pending');

  return (
    <DetailSection title="on_status Response">
      <div className={detailStyles.detailGrid}>
        <DetailRow label="Order Status" value={state} />
        <DetailRow label="Status Badge" value={state} />
        <DetailRow label="Order ID" value={stringValue(order.id)} />
        <DetailRow label="Order State" value={stringValue(order.state ?? order.status)} />
        <DetailRow label="Payment State" value={stringValue(payment.status)} />
        <DetailRow label="Fulfillment State" value={stringValue(fulfillment.state ?? fulfillment.status)} />
        <DetailRow label="Transaction State" value={stringValue(order.transaction_state ?? state)} />
        <DetailRow label="Amount" value={stringValue(price.value ?? order.amount)} />
        <DetailRow label="Scheme" value={schemeName} />
        <DetailRow label="Investor Details" value={investorName} />
      </div>
      {developerMode ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Raw JSON</AccordionSummary>
          <AccordionDetails>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </DetailSection>
  );
};

const waitForOndcEvent = (
  transactionId: string,
  eventName: 'ON_SELECT_RECEIVED' | 'ON_INIT_RECEIVED' | 'ON_CONFIRM_RECEIVED' | 'ON_STATUS_RECEIVED',
): { cancel: () => void; promise: Promise<OndcRealtimeEvent> } => {
  let unsubscribe: () => void = () => undefined;
  let timeout: number | undefined;
  const actionNameByEvent = {
    ON_SELECT_RECEIVED: '/on_select',
    ON_INIT_RECEIVED: '/on_init',
    ON_CONFIRM_RECEIVED: '/on_confirm',
    ON_STATUS_RECEIVED: '/on_status',
  };
  const promise = new Promise<OndcRealtimeEvent>((resolve, reject) => {
    timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ONDC ${actionNameByEvent[eventName]} callback.`));
    }, 60000);
    unsubscribe = ondcSocketService.subscribe((event: OndcRealtimeEvent) => {
      if (event.event === eventName && event.transaction_id === transactionId) {
        if (timeout) window.clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      }
    });
  });

  return {
    cancel: () => {
      if (timeout) window.clearTimeout(timeout);
      unsubscribe();
    },
    promise,
  };
};

const waitForOnSelect = (transactionId: string): { cancel: () => void; promise: Promise<OndcRealtimeEvent> } =>
  waitForOndcEvent(transactionId, 'ON_SELECT_RECEIVED');

const waitForOnInit = (transactionId: string): { cancel: () => void; promise: Promise<OndcRealtimeEvent> } =>
  waitForOndcEvent(transactionId, 'ON_INIT_RECEIVED');

const waitForOnConfirm = (transactionId: string): { cancel: () => void; promise: Promise<OndcRealtimeEvent> } =>
  waitForOndcEvent(transactionId, 'ON_CONFIRM_RECEIVED');

const waitForOnStatus = (transactionId: string): { cancel: () => void; promise: Promise<OndcRealtimeEvent> } =>
  waitForOndcEvent(transactionId, 'ON_STATUS_RECEIVED');

const JourneyProgress = ({
  finalOnSelectPayload,
  formCompleted,
  confirmPayload,
  initPayload,
  investmentTransactionId,
  onConfirmPayload,
  onInitPayload,
  onSelectPayload,
  onStatusPayload,
  rawCatalogPresent,
  secondSelectPayload,
  searchTransactionId,
  statusPayload,
}: {
  finalOnSelectPayload?: unknown;
  formCompleted: boolean;
  confirmPayload?: unknown;
  initPayload?: unknown;
  investmentTransactionId?: string;
  onConfirmPayload?: unknown;
  onInitPayload?: unknown;
  onSelectPayload?: unknown;
  onStatusPayload?: unknown;
  rawCatalogPresent: boolean;
  secondSelectPayload?: unknown;
  searchTransactionId?: string;
  statusPayload?: unknown;
}) => {
  const steps = [
    ['Search', Boolean(searchTransactionId)],
    ['on_search', rawCatalogPresent],
    ['Select', Boolean(investmentTransactionId)],
    ['on_select', Boolean(onSelectPayload)],
    ['Investor Form', formCompleted],
    ['Second Select', Boolean(secondSelectPayload)],
    ['Second on_select', Boolean(finalOnSelectPayload)],
    ['Init', Boolean(initPayload)],
    ['on_init', Boolean(onInitPayload)],
    ['Confirm', Boolean(confirmPayload)],
    ['on_confirm', Boolean(onConfirmPayload)],
    ['Payment', Boolean(statusPayload)],
    ['Status', Boolean(onStatusPayload)],
  ];

  return (
    <DetailSection title="Progress">
      <div className={detailStyles.documentLinks}>
        {steps.map(([label, done]) => (
          <span key={String(label)}>{done ? '[x]' : '[ ]'} {label}</span>
        ))}
      </div>
    </DetailSection>
  );
};

const TransactionSetup = () => {
  const navigate = useNavigate();
  const investorDetails = useMfJourneyStore((state) => state.investorDetails);
  const originalSelectTransactionId = useMfJourneyStore((state) => state.originalSelectTransactionId);
  const investmentTransactionId = useMfJourneyStore((state) => state.investmentTransactionId);
  const secondSelectTransactionId = useMfJourneyStore((state) => state.secondSelectTransactionId);
  const selectedScheme = useMfJourneyStore((state) => state.selectedScheme);
  const selectedSchemePayload = useMfJourneyStore((state) => state.selectedSchemePayload);
  const selectedQuote = useMfJourneyStore((state) => state.selectedQuote);
  const onSelectPayload = useMfJourneyStore((state) => state.onSelectPayload);
  const finalOnSelectPayload = useMfJourneyStore((state) => state.finalOnSelectPayload);
  const initPayloadDebug = useMfJourneyStore((state) => state.initPayload);
  const onInitPayload = useMfJourneyStore((state) => state.onInitPayload);
  const confirmPayloadDebug = useMfJourneyStore((state) => state.confirmPayload);
  const onConfirmPayload = useMfJourneyStore((state) => state.onConfirmPayload);
  const statusPayloadDebug = useMfJourneyStore((state) => state.statusPayload);
  const onStatusPayload = useMfJourneyStore((state) => state.onStatusPayload);
  const investorFormResponse = useMfJourneyStore((state) => state.investorFormResponse);
  const formSubmissionId = useMfJourneyStore((state) => state.formSubmissionId);
  const workbenchSession = useMfJourneyStore((state) => state.workbenchSession);
  const secondSelectPayloadDebug = useMfJourneyStore((state) => state.secondSelectPayload);
  const transactionDetails = useMfJourneyStore((state) => state.transactionDetails);
  const orderDetails = useMfJourneyStore((state) => state.orderDetails);
  const searchTransactionId = useMfJourneyStore((state) => state.searchTransactionId);
  const rawCatalog = useMfJourneyStore((state) => state.rawCatalog);
  const realtimeEvents = useMfJourneyStore((state) => state.realtimeEvents);
  const recordRealtimeEvent = useMfJourneyStore((state) => state.recordRealtimeEvent);
  const setInvestorFormResponse = useMfJourneyStore((state) => state.setInvestorFormResponse);
  const setInvestorFormMeta = useMfJourneyStore((state) => state.setInvestorFormMeta);
  const setOriginalSelectTransactionId = useMfJourneyStore((state) => state.setOriginalSelectTransactionId);
  const setSecondSelectTransactionId = useMfJourneyStore((state) => state.setSecondSelectTransactionId);
  const setOnSelectPayload = useMfJourneyStore((state) => state.setOnSelectPayload);
  const setInitPayload = useMfJourneyStore((state) => state.setInitPayload);
  const setOnInitPayload = useMfJourneyStore((state) => state.setOnInitPayload);
  const setConfirmPayload = useMfJourneyStore((state) => state.setConfirmPayload);
  const setOnConfirmPayload = useMfJourneyStore((state) => state.setOnConfirmPayload);
  const setStatusPayload = useMfJourneyStore((state) => state.setStatusPayload);
  const setOnStatusPayload = useMfJourneyStore((state) => state.setOnStatusPayload);
  const setWorkbenchSession = useMfJourneyStore((state) => state.setWorkbenchSession);
  const setSecondSelectPayload = useMfJourneyStore((state) => state.setSecondSelectPayload);
  const setSelectedScheme = useMfJourneyStore((state) => state.setSelectedScheme);
  const setTransactionDetails = useMfJourneyStore((state) => state.setTransactionDetails);
  const setOrderDetails = useMfJourneyStore((state) => state.setOrderDetails);
  const setCurrentStep = useMfJourneyStore((state) => state.setCurrentStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [secondSelectSubmittedOpen, setSecondSelectSubmittedOpen] = useState(false);
  const [onSelectModalOpen, setOnSelectModalOpen] = useState(false);
  const [initConfirmOpen, setInitConfirmOpen] = useState(false);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [activeStep, setActiveStep] = useState<WizardStepId>('search');
  const [developerMode, setDeveloperMode] = useState(false);
  const [investorFormMode, setInvestorFormMode] = useState<InvestorFormMode>('native');
  const [nativeFormFallbackReason, setNativeFormFallbackReason] = useState<string | undefined>();
  const [onUpdateEvents, setOnUpdateEvents] = useState<OndcRealtimeEvent[]>([]);
  const investorFormIframeRef = useRef<HTMLIFrameElement | null>(null);
  const routeTransactionId = new URLSearchParams(window.location.search).get('transaction_id') ?? undefined;
  const activeInvestmentTransactionId = investmentTransactionId ?? routeTransactionId;
  const investmentOptions = useMemo(() => investmentOptionsForScheme(selectedScheme), [selectedScheme]);
  const defaultInvestmentType = (investmentOptions[0]?.value ?? 'LUMPSUM') as InvestmentType;
  const form = findForm(onSelectPayload);
  const submissionId = investorFormResponse?.submission_id ?? formSubmissionId;
  const originalTransactionId = originalSelectTransactionId ?? workbenchSession?.transactionId ?? activeInvestmentTransactionId;
  const shouldShowForm = Boolean(form.url && !finalOnSelectPayload);
  const formCompleted = Boolean(investorFormResponse?.success === true && submissionId);
  const { control, handleSubmit, getValues, setValue, watch } = useForm<TransactionSetupForm>({
    defaultValues: {
      investmentType: defaultInvestmentType,
      amount: transactionDetails.amount,
      pan: investorDetails.pan,
      arn: '',
      euin: '',
      subBrokerArn: '',
      submissionId: submissionId ?? '',
    },
  });
  const watchedValues = watch();
  const selectedFulfillmentId = selectedScheme
    ? fulfillmentIdForType(selectedScheme, watchedValues.investmentType || defaultInvestmentType)
    : undefined;
  const secondSelectPayloadPreview = selectedScheme
    ? {
        transaction_id: originalTransactionId,
        session_id: workbenchSession?.sessionId,
        flow_id: workbenchSession?.flowId,
        form_submission_id: watchedValues.submissionId?.trim() || submissionId,
        provider_id: selectedScheme.providerId,
        scheme_item_id: selectedScheme.schemeItemId,
        item_id: selectedScheme.itemId,
        fulfillment_id: selectedFulfillmentId,
        amount: Number(watchedValues.amount),
        customer_pan: watchedValues.pan,
        arn: watchedValues.arn,
        euin: watchedValues.euin,
        sub_broker_arn: watchedValues.subBrokerArn,
      }
    : undefined;
  const orderId = extractOrderId(onInitPayload) ?? orderDetails?.buyerOrderId;
  const paymentId = extractPaymentId(onInitPayload) ?? orderDetails?.paymentReference ?? orderDetails?.messageId;
  const paymentUrl = findPaymentUrl(onConfirmPayload);
  const confirmProviderId = extractProviderId(onInitPayload) ?? extractProviderId(finalOnSelectPayload) ?? selectedScheme?.providerId;
  const hasSearch = Boolean(searchTransactionId || rawCatalog || selectedScheme || activeInvestmentTransactionId || onSelectPayload);
  const hasSelect = Boolean(selectedScheme || selectedQuote || activeInvestmentTransactionId || onSelectPayload || finalOnSelectPayload);
  const hasOnSelect = Boolean(onSelectPayload || shouldShowForm || submissionId || finalOnSelectPayload);
  const hasInvestorForm = Boolean(formCompleted || submissionId);
  const hasSecondSelect = Boolean(secondSelectPayloadDebug || finalOnSelectPayload);
  const recommendedStep: WizardStepId = onStatusPayload
    ? 'status'
    : statusPayloadDebug
      ? 'status'
      : paymentUrl
        ? 'payment'
        : onConfirmPayload
          ? 'onConfirm'
          : onInitPayload
            ? 'onInit'
            : initPayloadDebug
              ? 'init'
              : finalOnSelectPayload
                ? 'secondOnSelect'
                : hasSecondSelect
                  ? 'secondSelect'
                  : hasInvestorForm
                    ? 'secondSelect'
                    : shouldShowForm
                      ? 'investorForm'
                      : 'onSelect';

  useEffect(() => {
    setActiveStep(recommendedStep);
  }, [recommendedStep]);

  useEffect(() => {
    if (!activeInvestmentTransactionId) {
      return undefined;
    }

    ondcSocketService.connect(activeInvestmentTransactionId);
    const unsubscribe = ondcSocketService.subscribe((event: OndcRealtimeEvent) => {
      if (event.event !== 'ON_SELECT_RECEIVED' || event.transaction_id !== activeInvestmentTransactionId) {
        return;
      }

      recordRealtimeEvent(event);
      console.log('onSelectReceived', event.payload);
      const session = extractWorkbenchSession(event.payload);
      if (session.sessionId || session.flowId || session.transactionId) {
        setWorkbenchSession(session);
      }
      if (session.transactionId) {
        setOriginalSelectTransactionId(session.transactionId);
        console.log('First Select Transaction', session.transactionId);
      }
      setOnSelectPayload(event.payload);
    });

    return unsubscribe;
  }, [activeInvestmentTransactionId, recordRealtimeEvent, setOnSelectPayload, setOriginalSelectTransactionId, setWorkbenchSession]);

  useEffect(() => {
    if (onSelectPayload || !activeInvestmentTransactionId) {
      return;
    }

    const existingOnSelect = realtimeEvents.find(
      (event) => event.event === 'ON_SELECT_RECEIVED' && event.transaction_id === activeInvestmentTransactionId,
    );
    if (!existingOnSelect) {
      return;
    }

    const session = extractWorkbenchSession(existingOnSelect.payload);
    if (session.sessionId || session.flowId || session.transactionId) {
      setWorkbenchSession(session);
    }
    if (session.transactionId) {
      setOriginalSelectTransactionId(session.transactionId);
    }
    setOnSelectPayload(existingOnSelect.payload);
  }, [
    activeInvestmentTransactionId,
    onSelectPayload,
    realtimeEvents,
    setOnSelectPayload,
    setOriginalSelectTransactionId,
    setWorkbenchSession,
  ]);

  useEffect(() => {
    if (!secondSelectTransactionId) {
      return undefined;
    }

    const unsubscribe = ondcSocketService.subscribe((event: OndcRealtimeEvent) => {
      if (event.event === 'ON_UPDATE_RECEIVED' && event.transaction_id === secondSelectTransactionId) {
        setOnUpdateEvents((events) => [event, ...events].slice(0, 20));
      }
    });

    return unsubscribe;
  }, [secondSelectTransactionId]);

  useEffect(() => {
    console.log('submission_id', submissionId);
    console.log('formCompleted', formCompleted);
    if (submissionId) {
      if (!getValues('submissionId')) {
        setValue('submissionId', submissionId);
      }
      setSubmitError(undefined);
    }
  }, [formCompleted, getValues, setValue, submissionId]);

  useEffect(() => {
    const session = extractWorkbenchSession(onSelectPayload);
    if (session.sessionId || session.flowId || session.transactionId) {
      setWorkbenchSession(session);
    }
    if (session.transactionId) {
      setOriginalSelectTransactionId(session.transactionId);
      console.log('First Select Transaction', session.transactionId);
    }
  }, [onSelectPayload, setOriginalSelectTransactionId, setWorkbenchSession]);

  useEffect(() => {
    if (form.url || form.id) {
      setInvestorFormMeta({
        formId: form.id,
        formUrl: form.url,
      });
    }
  }, [form.id, form.url, setInvestorFormMeta]);

  useEffect(() => {
    setInvestorFormMode('native');
    setNativeFormFallbackReason(undefined);
    setIsIframeLoading(true);
  }, [form.url]);

  const completeInvestorForm = useCallback((response: InvestorFormResponse) => {
    if (response.success === true && response.submission_id) {
      console.log('Investor form completed', response);
      console.log('Submission ID', response.submission_id);
      console.log('submission_id', response.submission_id);
      setInvestorFormResponse(response);
      setValue('submissionId', response.submission_id);
      setSubmitError(undefined);
    }
  }, [setInvestorFormResponse, setValue]);

  const readIframeFormResponse = useCallback((iframe: HTMLIFrameElement): InvestorFormResponse | undefined => {
    try {
      const urlResponse = extractInvestorFormResponseFromUrl(iframe.contentWindow?.location.href);
      if (urlResponse) {
        completeInvestorForm(urlResponse);
        return urlResponse;
      }

      const bodyText =
        iframe.contentDocument?.body?.innerText?.trim() ||
        iframe.contentDocument?.body?.textContent?.trim() ||
        iframe.contentDocument?.documentElement?.textContent?.trim();
      const bodyResponse = extractInvestorFormResponse(bodyText);
      if (bodyResponse) {
        completeInvestorForm(bodyResponse);
        return bodyResponse;
      }
    } catch (error) {
      console.warn('Unable to read investor form iframe response', error);
    }
    return undefined;
  }, [completeInvestorForm]);

  const scheduleIframeResponseRead = useCallback((iframe: HTMLIFrameElement) => {
    if (readIframeFormResponse(iframe)) {
      return;
    }

    [250, 750, 1500, 3000, 5000, 8000, 12000, 15000].forEach((delay) => {
      window.setTimeout(() => readIframeFormResponse(iframe), delay);
    });
  }, [readIframeFormResponse]);

  const fallbackToIframeForm = useCallback((reason: string) => {
    setNativeFormFallbackReason(reason);
    setInvestorFormMode('iframe');
    setIsIframeLoading(true);
  }, []);

  useEffect(() => {
    if (form.url) {
      console.log('Investor form URL found', form);
    } else if (onSelectPayload) {
      console.log('Investor form URL missing in on_select payload', onSelectPayload);
    }
  }, [form.id, form.url, onSelectPayload]);

  useEffect(() => {
    const receiveSubmission = (event: MessageEvent) => {
      const response = extractInvestorFormResponse(event.data);
      if (response) {
        completeInvestorForm(response);
      }
    };

    window.addEventListener('message', receiveSubmission);
    return () => window.removeEventListener('message', receiveSubmission);
  }, [completeInvestorForm]);

  const buildTransactionDetails = (values: TransactionSetupForm): TransactionDetails => ({
    ...transactionDetails,
    transactionType: values.investmentType === 'SIP' ? 'SIP Registration' : 'Lumpsum Purchase',
    amount: Number(values.amount),
    amountInWords: amountToWords(Number(values.amount)),
  });

  const runSecondSelect = async (values: TransactionSetupForm, details: TransactionDetails, activeSubmissionId: string) => {
    if (!selectedScheme) {
      return;
    }

    const secondTransactionId = originalTransactionId;
    if (!secondTransactionId) {
      setSubmitError('Original select transaction is missing. Please select the scheme again.');
      return;
    }

    const fulfillmentId = fulfillmentIdForType(selectedScheme, values.investmentType);
    const secondSelectPayload = {
      transaction_id: secondTransactionId,
      session_id: workbenchSession?.sessionId,
      flow_id: workbenchSession?.flowId,
      form_submission_id: activeSubmissionId,
      provider_id: selectedScheme.providerId,
      item_id: selectedScheme.itemId,
      scheme_item_id: selectedScheme.schemeItemId,
      fulfillment_id: fulfillmentId,
      fulfillment_type: values.investmentType,
      amount: Number(values.amount),
      customer_pan: values.pan,
      arn: values.arn,
      euin: values.euin,
      sub_broker_arn: values.subBrokerArn,
      selected_investment_type: values.investmentType,
    };

    console.log('secondSelectPayload', secondSelectPayload);
    console.log('First Select Transaction', originalTransactionId);
    console.log('Second Select Transaction', secondSelectPayload.transaction_id);
    console.log('submission_id', activeSubmissionId);
    console.log('investorFormResponse', investorFormResponse);

    setSecondSelectPayload(secondSelectPayload);
    setSecondSelectTransactionId(secondTransactionId);
    ondcSocketService.connect(secondTransactionId);
    const onSelectReceived = waitForOnSelect(secondTransactionId);

    try {
      setIsSubmittingForm(true);
      const response = await selectScheme(selectedScheme, secondTransactionId, {
        amount: Number(values.amount),
        arn: values.arn,
        customerPan: values.pan,
        euin: values.euin,
        fulfillmentId,
        fulfillmentType: values.investmentType,
        formId: form.id || 'investor_details_form',
        formSubmissionId: activeSubmissionId,
        sessionId: workbenchSession?.sessionId,
        flowId: workbenchSession?.flowId,
        workbenchTransactionId: secondTransactionId,
        subBrokerArn: values.subBrokerArn,
      });
      setSecondSelectSubmittedOpen(true);
      const event = await onSelectReceived.promise;
      console.log('onSelectReceived', event.payload);
      setSelectedScheme(selectedScheme, selectedSchemePayload, response.data);
      setTransactionDetails(details);
      setOnSelectPayload(event.payload, true);
      setSecondSelectSubmittedOpen(false);
      setOnSelectModalOpen(true);
    } catch (error) {
      onSelectReceived.cancel();
      throw error;
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const runInit = async (values: TransactionSetupForm, details: TransactionDetails) => {
    if (!selectedScheme) {
      return;
    }

    const initTransactionId = secondSelectTransactionId;
    if (!initTransactionId) {
      setSubmitError('Second select transaction is missing. Please continue again.');
      return;
    }

    const initPayload = {
      transaction_id: initTransactionId,
      provider_id: selectedScheme.providerId,
      item_id: selectedScheme.itemId,
      fulfillment_id: fulfillmentIdForType(selectedScheme, values.investmentType),
      fulfillment_type: values.investmentType,
      amount: Number(values.amount),
      customer_pan: values.pan,
      arn: values.arn,
      euin: values.euin,
      sub_broker_arn: values.subBrokerArn,
      form_submission_id: submissionId,
    };
    console.log('initPayload', initPayload);
    setInitPayload(initPayload);

    ondcSocketService.connect(initTransactionId);
    const onInitReceived = waitForOnInit(initTransactionId);

    try {
      setSubmitError(undefined);
      setIsSubmitting(true);
      const response = await initOrder({
        investorDetails: { ...investorDetails, pan: values.pan },
        formSubmissionId: submissionId,
        investmentTransactionId: initTransactionId,
        selectedScheme,
        selectedSchemePayload,
        transactionDetails: details,
      });
      const event = await onInitReceived.promise;
      console.log('onInitReceived', event.payload);
      setOnInitPayload(event.payload);
      setOrderDetails({
        ...response.data,
        buyerOrderId: extractOrderId(event.payload) ?? response.data.buyerOrderId,
        providerId: extractProviderId(event.payload) ?? extractProviderId(finalOnSelectPayload) ?? selectedScheme.providerId,
        paymentReference: extractPaymentId(event.payload) ?? response.data.paymentReference,
      });
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      onInitReceived.cancel();
      setSubmitError(extractApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const runConfirm = async () => {
    if (!selectedScheme || !orderDetails || !secondSelectTransactionId) {
      setSubmitError('Init details are missing. Please complete init before confirm.');
      return;
    }

    if (!orderId || !paymentId) {
      setSubmitError('Order ID or payment ID is missing from on_init response.');
      return;
    }

    if (!confirmProviderId) {
      setSubmitError('Provider ID missing. Cannot call confirm.');
      return;
    }

    const confirmPayload = {
      transaction_id: secondSelectTransactionId,
      provider_id: confirmProviderId,
      order_id: orderId,
      item_id: selectedScheme.itemId,
      fulfillment_id: selectedSchemePayload?.fulfillment_ids[0] ?? selectedScheme.fulfillmentIds[0],
      amount: transactionDetails.amount,
      customer_pan: investorDetails.pan,
      form_submission_id: submissionId,
      payment_id: paymentId,
    };
    console.log('Final Confirm Payload', confirmPayload);
    setConfirmPayload(confirmPayload);

    ondcSocketService.connect(secondSelectTransactionId);
    const onConfirmReceived = waitForOnConfirm(secondSelectTransactionId);

    try {
      setSubmitError(undefined);
      setIsConfirmingOrder(true);
      const response = await confirmOrder({
        investorDetails,
        investmentTransactionId: secondSelectTransactionId,
        orderDetails,
        orderId,
        paymentId,
        providerId: confirmProviderId,
        selectedScheme,
        selectedSchemePayload,
        transactionDetails,
        formSubmissionId: submissionId,
      });
      const event = await onConfirmReceived.promise;
      console.log('onConfirmReceived', event.payload);
      setOnConfirmPayload(event.payload);
      setOrderDetails({
        ...response.data,
        buyerOrderId: extractOrderId(event.payload) ?? orderId,
        providerId: extractProviderId(event.payload) ?? confirmProviderId,
        paymentReference: extractPaymentId(event.payload) ?? paymentId,
        status: 'IN_PROGRESS',
      });
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      onConfirmReceived.cancel();
      setSubmitError(extractApiError(error));
    } finally {
      setIsConfirmingOrder(false);
      setConfirmOrderOpen(false);
    }
  };

  const runStatus = async () => {
    if (!selectedScheme || !secondSelectTransactionId) {
      setSubmitError('Transaction details are missing. Please complete confirm before status.');
      return;
    }

    const activeOrderId = extractOrderId(onConfirmPayload) ?? orderId;
    if (!activeOrderId) {
      setSubmitError('Order ID is missing. Unable to request status.');
      return;
    }

    const statusPayload = {
      transaction_id: secondSelectTransactionId,
      order_id: activeOrderId,
    };
    console.log('statusPayload', statusPayload);
    setStatusPayload(statusPayload);

    ondcSocketService.connect(secondSelectTransactionId);
    const onStatusReceived = waitForOnStatus(secondSelectTransactionId);

    try {
      setSubmitError(undefined);
      setIsCheckingStatus(true);
      await getOrderStatus(activeOrderId, secondSelectTransactionId, {
        bppId: selectedScheme.bppId,
        bppUri: selectedScheme.bppUri,
      });
      const event = await onStatusReceived.promise;
      console.log('onStatusReceived', event.payload);
      setOnStatusPayload(event.payload);
      setCurrentStep(5);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      onStatusReceived.cancel();
      setSubmitError(extractApiError(error));
    } finally {
      setIsCheckingStatus(false);
      setPaymentConfirmOpen(false);
    }
  };

  const submit = async (values: TransactionSetupForm) => {
    if (!selectedScheme) {
      setCurrentStep(1);
      navigate('/catalogue');
      return;
    }

    if (!activeInvestmentTransactionId) {
      setSubmitError('Investment transaction is missing. Please select the scheme again.');
      return;
    }

    if (onInitPayload) {
      navigate('/review');
      return;
    }

    const latestInvestorFormResponse =
      values.submissionId?.trim()
        ? { success: true, submission_id: values.submissionId.trim() }
        : investorFormResponse?.submission_id
        ? investorFormResponse
        : investorFormIframeRef.current
          ? readIframeFormResponse(investorFormIframeRef.current)
          : undefined;
    const activeSubmissionId = latestInvestorFormResponse?.submission_id ?? formSubmissionId;

    if (!values.pan?.trim()) {
      setSubmitError('PAN is required.');
      return;
    }

    if (!Number(values.amount)) {
      setSubmitError('Amount is required.');
      return;
    }

    if (!finalOnSelectPayload && !activeSubmissionId) {
      setSubmitError('Submission ID is required.');
      return;
    }

    try {
      setSubmitError(undefined);
      setIsSubmitting(true);
      if (activeSubmissionId && investorFormResponse?.submission_id !== activeSubmissionId) {
        setInvestorFormResponse({ success: true, submission_id: activeSubmissionId });
      }

      const details = buildTransactionDetails(values);
      setTransactionDetails(details);

      if (!finalOnSelectPayload) {
        if (!activeSubmissionId) {
          setSubmitError('Submission ID is required.');
          return;
        }
        await runSecondSelect(values, details, activeSubmissionId);
        return;
      }

      setInitConfirmOpen(true);
    } catch (error) {
      setSubmitError(extractApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepComplete = (stepId: WizardStepId): boolean => {
    const completion: Record<WizardStepId, boolean> = {
      search: hasSearch,
      select: hasSelect,
      onSelect: hasOnSelect,
      investorForm: hasInvestorForm,
      secondSelect: hasSecondSelect,
      secondOnSelect: Boolean(finalOnSelectPayload),
      init: Boolean(initPayloadDebug),
      onInit: Boolean(onInitPayload),
      confirm: Boolean(confirmPayloadDebug),
      onConfirm: Boolean(onConfirmPayload),
      payment: Boolean(statusPayloadDebug),
      status: Boolean(onStatusPayload),
      onUpdate: onUpdateEvents.length > 0,
    };

    return completion[stepId];
  };

  const stepStatus = (stepId: WizardStepId): 'completed' | 'inProgress' | 'pending' => {
    if (isStepComplete(stepId)) return 'completed';
    return activeStep === stepId ? 'inProgress' : 'pending';
  };

  const activeStage = (() => {
    if (['search', 'select', 'onSelect', 'investorForm', 'secondSelect', 'secondOnSelect'].includes(activeStep)) return 'Select';
    if (['init', 'onInit'].includes(activeStep)) return 'Init';
    if (['confirm', 'onConfirm'].includes(activeStep)) return 'Confirm';
    if (activeStep === 'payment') return 'Payment';
    return 'Status';
  })();

  const renderRawAccordion = (title: string, payload?: unknown) =>
    developerMode && payload !== undefined ? (
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>{title}</AccordionSummary>
        <AccordionDetails>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </AccordionDetails>
      </Accordion>
    ) : null;

  const renderEmptyState = (message: string) => <p className={detailStyles.emptyState}>{message}</p>;

  const renderActiveStep = () => {
    switch (activeStep) {
      case 'onSelect':
        return (
          <>
            <DetailSection title="Selected Scheme">
              {selectedScheme ? (
                <div className={detailStyles.detailGrid}>
                  <DetailRow label="Scheme Name" value={selectedScheme.name} />
                  <DetailRow label="AMC" value={selectedScheme.amcName || selectedScheme.providerName} />
                  <DetailRow label="ISIN" value={selectedScheme.identifiers.isin} />
                  <DetailRow label="Transaction ID" value={investmentTransactionId ?? originalTransactionId} />
                </div>
              ) : (
                <>
                  {renderEmptyState('No scheme selected. Please choose a scheme from catalogue.')}
                  <div className={styles.actions}>
                    <Button variant="contained" onClick={() => navigate('/catalogue')}>
                      Open Catalogue
                    </Button>
                  </div>
                </>
              )}
            </DetailSection>
            {onSelectPayload ? (
              <OnSelectResponse developerMode={developerMode} payload={onSelectPayload} scheme={selectedScheme} title="On Select" />
            ) : (
              <DetailSection title="On Select">{renderEmptyState('Waiting for on_select response...')}</DetailSection>
            )}
          </>
        );
      case 'investorForm':
        return (
          <>
            <DetailSection title="Investor Details">
              <ToggleButtonGroup
                exclusive
                onChange={(_, value: InvestorFormMode | null) => {
                  if (value) {
                    setInvestorFormMode(value);
                    setNativeFormFallbackReason(undefined);
                    setIsIframeLoading(value === 'iframe');
                  }
                }}
                size="small"
                value={investorFormMode}
              >
                <ToggleButton value="native">Use Native Form</ToggleButton>
                <ToggleButton value="iframe">Use Iframe</ToggleButton>
              </ToggleButtonGroup>

              {nativeFormFallbackReason ? (
                <Alert severity="warning">Native form unavailable. Falling back to iframe: {nativeFormFallbackReason}</Alert>
              ) : null}

              {shouldShowForm ? (
                investorFormMode === 'native' && form.url ? (
                  <InvestorDetailsReactForm
                    developerMode={developerMode}
                    formUrl={form.url}
                    onFallback={fallbackToIframeForm}
                    onSubmitted={completeInvestorForm}
                    submissionId={submissionId ?? formSubmissionId}
                  />
                ) : (
                  <>
                  {isIframeLoading ? <p className={detailStyles.emptyState}>Loading form...</p> : null}
                  <iframe
                    ref={investorFormIframeRef}
                    src={iframeFormUrl(form.url)}
                    title="Investor form"
                    className={detailStyles.fullFrame}
                    onLoad={(event) => {
                      setIsIframeLoading(false);
                      scheduleIframeResponseRead(event.currentTarget);
                    }}
                  />
                  {isSubmittingForm ? <p className={detailStyles.emptyState}>Submitting form response...</p> : null}
                  </>
                )
              ) : (
                renderEmptyState(formCompleted ? 'Investor form submitted.' : 'Investor form URL is not available yet.')
              )}
            </DetailSection>
            <DetailSection title="Submission Status">
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Submission ID" value={submissionId ?? formSubmissionId} />
                <DetailRow label="Status" value={formCompleted ? 'Success' : 'Pending'} />
              </div>
              <div className={styles.actions}>
                <Button
                  disabled={!formCompleted}
                  endIcon={<NavigateNextIcon />}
                  onClick={() => setActiveStep('secondSelect')}
                  variant="contained"
                >
                  Continue To Second Select
                </Button>
              </div>
            </DetailSection>
          </>
        );
      case 'secondSelect':
        return (
          <form onSubmit={handleSubmit(submit)}>
            <DetailSection title="Second Select">
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Submission ID" value={submissionId ?? formSubmissionId} />
                <DetailRow label="Transaction ID" value={originalTransactionId} />
                <DetailRow label="Session ID" value={workbenchSession?.sessionId} />
              </div>
            </DetailSection>
            <div className={styles.grid}>
              <FormField control={control} name="investmentType" label="Investment Type" options={investmentOptions} />
              <FormField control={control} name="amount" label="Amount / Units" type="number" required />
              <FormField control={control} name="pan" label="PAN" required />
              <FormField control={control} name="arn" label="ARN" />
              <FormField control={control} name="euin" label="EUIN" />
              <FormField control={control} name="subBrokerArn" label="Sub Broker ARN" />
              <FormField control={control} name="submissionId" label="Submission ID" required />
            </div>
            <div className={styles.actions}>
              <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/catalogue')}>
                Back
              </Button>
              <Button type="submit" variant="contained" endIcon={<NavigateNextIcon />} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Execute Second Select'}
              </Button>
            </div>
          </form>
        );
      case 'secondOnSelect':
        return (
          <>
            <SecondOnSelectResponse developerMode={developerMode} payload={finalOnSelectPayload} scheme={selectedScheme} />
            <div className={styles.actions}>
              <Button variant="contained" onClick={() => setInitConfirmOpen(true)} disabled={!finalOnSelectPayload || isSubmitting}>
                Continue to Init
              </Button>
            </div>
          </>
        );
      case 'init':
        return (
          <>
            <DetailSection title="Order Summary">
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Scheme" value={selectedScheme?.name} />
                <DetailRow label="Quote" value={stringify(getQuote(finalOnSelectPayload))} />
                <DetailRow label="Payment Method" value={transactionDetails.paymentMode} />
              </div>
            </DetailSection>
            <div className={styles.actions}>
              <Button variant="contained" onClick={() => setInitConfirmOpen(true)} disabled={!finalOnSelectPayload || isSubmitting}>
                Execute Init
              </Button>
            </div>
            {renderRawAccordion('Init Payload', initPayloadDebug)}
          </>
        );
      case 'onInit':
        return (
          <>
            <OnInitResponse developerMode={developerMode} payload={onInitPayload} />
            <div className={styles.actions}>
              <Button variant="contained" onClick={() => setConfirmOrderOpen(true)} disabled={!onInitPayload || isConfirmingOrder}>
                Continue to Confirm
              </Button>
            </div>
          </>
        );
      case 'confirm':
        return (
          <>
            <DetailSection title="Confirm Investment">
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Order Amount" value={String(transactionDetails.amount)} />
                <DetailRow label="Scheme" value={selectedScheme?.name} />
                <DetailRow label="Payment Method" value={transactionDetails.paymentMode} />
                <DetailRow label="Provider ID" value={confirmProviderId} />
                <DetailRow label="Order ID" value={orderId} />
                <DetailRow label="Transaction ID" value={secondSelectTransactionId} />
              </div>
            </DetailSection>
            <div className={styles.actions}>
              <Button variant="contained" onClick={() => setConfirmOrderOpen(true)} disabled={!onInitPayload || isConfirmingOrder}>
                Confirm Investment
              </Button>
            </div>
            {renderRawAccordion('Confirm Payload', confirmPayloadDebug)}
          </>
        );
      case 'onConfirm':
        return (
          <>
            <DetailSection title="Order Accepted">
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Order ID" value={extractOrderId(onConfirmPayload) ?? orderId} />
                <DetailRow label="State" value={stringValue(getOrder(onConfirmPayload).state ?? getOrder(onConfirmPayload).status)} />
                <DetailRow label="Quote" value={stringify(getOrder(onConfirmPayload).quote)} />
              </div>
            </DetailSection>
            <OnConfirmResponse developerMode={developerMode} payload={onConfirmPayload} />
            <div className={styles.actions}>
              {paymentUrl ? (
                <Button variant="contained" href={paymentUrl} target="_blank" rel="noreferrer">
                  Open Payment
                </Button>
              ) : null}
            </div>
            {paymentUrl ? (
              <DetailSection title="Payment URL">
                <div className={detailStyles.detailGrid}>
                  <DetailRow label="Payment URL" value={paymentUrl} />
                </div>
                <iframe src={paymentUrl} title="Payment authorization" className={detailStyles.fullFrame} />
              </DetailSection>
            ) : null}
          </>
        );
      case 'payment':
        return paymentUrl ? (
          <DetailSection title="Payment">
            <iframe src={paymentUrl} title="Payment" className={detailStyles.paymentFrame} />
            <div className={styles.actions}>
              <Button variant="contained" onClick={() => setPaymentConfirmOpen(true)}>
                I Have Completed Payment
              </Button>
            </div>
          </DetailSection>
        ) : (
          <DetailSection title="Payment">{renderEmptyState('Payment URL is not available yet.')}</DetailSection>
        );
      case 'status':
        return (
          <>
            <DetailSection title="Order Status">
              <div className={detailStyles.detailGrid}>
                <DetailRow label="Order Status" value={stringValue(getOrder(onStatusPayload).state ?? getOrder(onStatusPayload).status)} />
                <DetailRow label="Payment Status" value={stringValue(extractPayment(onStatusPayload).status)} />
                <DetailRow label="Transaction State" value={stringValue(getOrder(onStatusPayload).transaction_state)} />
                <DetailRow label="Investor Name" value={investorDetails.investorName} />
                <DetailRow label="Order ID" value={extractOrderId(onStatusPayload) ?? orderId} />
              </div>
            </DetailSection>
            <div className={styles.actions}>
              <Button variant="contained" onClick={() => void runStatus()} disabled={isCheckingStatus}>
                {isCheckingStatus ? 'Refreshing...' : 'Refresh Status'}
              </Button>
            </div>
            <OnStatusResponse developerMode={developerMode} investorName={investorDetails.investorName} payload={onStatusPayload} schemeName={selectedScheme?.name} />
          </>
        );
      case 'onUpdate':
        return (
          <DetailSection title="On Update Timeline">
            {onUpdateEvents.length ? (
              <div className={detailStyles.timeline}>
                {onUpdateEvents.map((event, index) => (
                  <div className={detailStyles.timelineItem} key={`${event.transaction_id}-${index}`}>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <strong>{stringValue(getOrder(event.payload).state ?? getOrder(event.payload).status ?? 'Update received')}</strong>
                    {developerMode ? <pre>{JSON.stringify(event.payload, null, 2)}</pre> : null}
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState('No on_update callbacks received yet.')
            )}
          </DetailSection>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className={detailStyles.wizardShell}>
        <aside className={detailStyles.sidebar}>
          <div className={detailStyles.sidebarHeader}>
            <span>MF Journeys</span>
            <strong>Lumpsum New Folio</strong>
          </div>
          <nav className={detailStyles.stepList}>
            {wizardSteps.map((step, index) => {
              const status = stepStatus(step.id);
              return (
                <button
                  className={`${detailStyles.stepButton} ${activeStep === step.id ? detailStyles.activeStep : ''}`}
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  type="button"
                >
                  <span className={detailStyles.stepIcon}>{status === 'completed' ? '✓' : status === 'inProgress' ? '⏳' : '○'}</span>
                  <span>{index + 1}. {step.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className={detailStyles.mainArea}>
          <div className={detailStyles.topBar}>
            <div className={detailStyles.stageBar}>
              {['Select', 'Init', 'Confirm', 'Payment', 'Status'].map((stage) => (
                <span
                  className={stage === activeStage ? detailStyles.activeStage : ''}
                  key={stage}
                >
                  {stage}
                </span>
              ))}
            </div>
            <label className={detailStyles.devToggle}>
              <input checked={developerMode} onChange={(event) => setDeveloperMode(event.target.checked)} type="checkbox" />
              Developer Mode
            </label>
          </div>

          <Card className={styles.panel}>
            <CardContent className={styles.content}>
              <div className={detailStyles.stepHeader}>
                <div>
                  <p>Step {wizardSteps.findIndex((step) => step.id === activeStep) + 1}</p>
                  <h2>{wizardSteps.find((step) => step.id === activeStep)?.label}</h2>
                  <span>{wizardSteps.find((step) => step.id === activeStep)?.description}</span>
                </div>
                <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/catalogue')}>
                  Catalogue
                </Button>
              </div>

              {selectedScheme && activeStep !== 'search' ? (
                <div className={detailStyles.compactScheme}>
                  <strong>{selectedScheme.name}</strong>
                  <span>{selectedScheme.amcName || selectedScheme.providerName || selectedScheme.identifiers.isin}</span>
                </div>
              ) : null}

              {submitError ? <Alert severity="error">{submitError}</Alert> : null}

              <div className={detailStyles.stepContent}>{renderActiveStep()}</div>

              {developerMode ? (
                <DetailSection title="Developer Debug">
                  <div className={detailStyles.detailGrid}>
                    <DetailRow label="session_id" value={workbenchSession?.sessionId} />
                    <DetailRow label="flow_id" value={workbenchSession?.flowId} />
                    <DetailRow label="transaction_id" value={originalTransactionId} />
                    <DetailRow label="submission_id" value={submissionId ?? formSubmissionId} />
                    <DetailRow label="order_id" value={orderId} />
                  </div>
                  {renderRawAccordion('second_select_payload', secondSelectPayloadDebug ?? secondSelectPayloadPreview)}
                  {renderRawAccordion('init_payload', initPayloadDebug)}
                  {renderRawAccordion('on_init_response', onInitPayload)}
                  {renderRawAccordion('confirm_payload', confirmPayloadDebug)}
                  {renderRawAccordion('on_confirm_response', onConfirmPayload)}
                  {renderRawAccordion('status_payload', statusPayloadDebug)}
                  {renderRawAccordion('on_status_response', onStatusPayload)}
                </DetailSection>
              ) : null}
            </CardContent>
          </Card>
        </main>
      </div>
      <Dialog open={secondSelectSubmittedOpen} onClose={() => setSecondSelectSubmittedOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Second Select Submitted</DialogTitle>
        <DialogContent>
          <p>Waiting for ONDC on_select callback</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSecondSelectSubmittedOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={onSelectModalOpen} onClose={() => setOnSelectModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>on_select Received</DialogTitle>
        <DialogContent>
          <OnSelectResponse payload={finalOnSelectPayload} scheme={selectedScheme} title="on_select Received" />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            endIcon={<NavigateNextIcon />}
            onClick={() => {
              setOnSelectModalOpen(false);
              setInitConfirmOpen(true);
            }}
          >
            Proceed To Init
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={initConfirmOpen} onClose={() => setInitConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Proceed with Init?</DialogTitle>
        <DialogContent>
          <p>This will create the order initialization request.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInitConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const values = getValues();
              const details = buildTransactionDetails(values);
              setTransactionDetails(details);
              setInitConfirmOpen(false);
              void runInit(values, details);
            }}
            disabled={isSubmitting}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOrderOpen} onClose={() => setConfirmOrderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Order?</DialogTitle>
        <DialogContent>
          <div className={detailStyles.detailGrid}>
            <DetailRow label="Order Amount" value={String(transactionDetails.amount)} />
            <DetailRow label="Scheme" value={selectedScheme?.name} />
            <DetailRow label="Payment Method" value={transactionDetails.paymentMode} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOrderOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void runConfirm()} disabled={isConfirmingOrder}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentConfirmOpen} onClose={() => setPaymentConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Have you completed payment?</DialogTitle>
        <DialogContent>
          <p>Confirm payment completion to move to the status step.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentConfirmOpen(false)}>No</Button>
          <Button variant="contained" onClick={() => void runStatus()} disabled={isCheckingStatus}>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TransactionSetup;
