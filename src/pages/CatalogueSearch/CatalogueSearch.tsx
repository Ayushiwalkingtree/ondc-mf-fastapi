import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Link,
  Snackbar,
} from '@mui/material';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import DeveloperPanel from '../../components/DeveloperPanel/DeveloperPanel';
import FormField from '../../components/FormField/FormField';
import type { FieldOption } from '../../components/FormField/FormField';
import SchemeCard from '../../components/SchemeCard/SchemeCard';
import { handleOndcRealtimeEvent } from '../../services/ondcEventHandler';
import { ondcSocketService } from '../../services/ondcSocket.service';
import { getSearchStatus, searchSchemes } from '../../services/search.service';
import { selectScheme } from '../../services/select.service';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import type { OndcRealtimeEvent } from '../../types/ondc';
import type { OndcOnSearchPayload, ParsedScheme, SchemeSearchParams } from '../../types/scheme';
import { parseOnSearchCatalog } from '../../utils/catalogParser';
import { mapSchemeToSelection } from '../../utils/schemeMapper';
import pageStyles from '../page.module.scss';
import styles from './CatalogueSearch.module.scss';

interface SearchFormValues {
  category: string;
}

type InvestmentType = 'LUMPSUM' | 'SIP';

const categoryOptions: FieldOption[] = [
  { label: 'All Categories', value: '' },
  { label: 'Equity', value: 'Equity' },
  { label: 'Debt', value: 'Debt' },
  { label: 'Hybrid', value: 'Hybrid' },
  { label: 'Index', value: 'Index' },
  { label: 'ELSS', value: 'ELSS' },
  { label: 'Large Cap', value: 'Large Cap' },
  { label: 'Mid Cap', value: 'Mid Cap' },
  { label: 'Small Cap', value: 'Small Cap' },
  { label: 'Flexi Cap', value: 'Flexi Cap' },
  { label: 'Multi Cap', value: 'Multi Cap' },
  { label: 'Liquid', value: 'Liquid' },
];

const defaultSearchValues: SearchFormValues = {
  category: '',
};

const SEARCH_POLL_INTERVAL_MS = 3000;
const SEARCH_TIMEOUT_MS = 60000;

const supportsFulfillmentType = (scheme: ParsedScheme, type: InvestmentType): boolean =>
  scheme.fulfillmentDetails.some((fulfillment) =>
    `${fulfillment.type ?? ''} ${fulfillment.label}`.toUpperCase().includes(type),
  );

const defaultFulfillmentType = (scheme: ParsedScheme): InvestmentType =>
  supportsFulfillmentType(scheme, 'LUMPSUM') ? 'LUMPSUM' : 'SIP';

const fulfillmentIdForType = (scheme: ParsedScheme, type: InvestmentType): string | undefined =>
  scheme.fulfillmentDetails.find((fulfillment) =>
    `${fulfillment.type ?? ''} ${fulfillment.label}`.toUpperCase().includes(type),
  )?.id ?? scheme.fulfillmentIds[0];

const createTransactionId = (): string =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const waitForOnSelect = (transactionId: string): { cancel: () => void; promise: Promise<OndcRealtimeEvent> } => {
  let unsubscribe: () => void = () => undefined;
  let timeout: number | undefined;
  const promise = new Promise<OndcRealtimeEvent>((resolve, reject) => {
    timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for ONDC /on_select callback.'));
    }, 60000);
    unsubscribe = ondcSocketService.subscribe((event: OndcRealtimeEvent) => {
      if (event.event === 'ON_SELECT_RECEIVED' && event.transaction_id === transactionId) {
        if (timeout) {
          window.clearTimeout(timeout);
        }
        unsubscribe();
        resolve(event);
      }
    });
  });

  return {
    cancel: () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      unsubscribe();
    },
    promise,
  };
};

const hasValue = (value?: string): value is string => Boolean(value && value.trim());

const formatText = (value?: string): string | undefined => {
  if (!hasValue(value)) {
    return undefined;
  }

  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 4 && part === part.toUpperCase() ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(' ');
};

const DetailField = ({ label, value }: { label: string; value?: string }) =>
  hasValue(value) ? (
    <div className={styles.detailField}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ) : null;

const DetailSection = ({ children, title }: { children: ReactNode; title: string }) => {
  const content = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(content) && !content.length) {
    return null;
  }

  return (
    <section className={styles.detailSection}>
      <h3>{title}</h3>
      <div className={styles.detailGrid}>{content}</div>
    </section>
  );
};

const DetailsDrawer = ({
  onClose,
  onSelect,
  scheme,
}: {
  onClose: () => void;
  onSelect: (scheme: ParsedScheme) => void;
  scheme?: ParsedScheme;
}) => (
  <Drawer anchor="right" open={Boolean(scheme)} onClose={onClose} PaperProps={{ className: styles.drawerPaper }}>
    {scheme ? (
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div>
            {scheme.amcName ? <p>{scheme.amcName}</p> : null}
            <h2>{scheme.name}</h2>
          </div>
          <IconButton aria-label="Close details" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className={styles.drawerActions}>
          <Button variant="contained" onClick={() => onSelect(scheme)}>
            Select Scheme
          </Button>
        </div>

        <Divider />

        <DetailSection title="Scheme Information">
          <DetailField label="Status" value={scheme.status} />
          <DetailField label="Lock-in Period" value={scheme.lockInPeriod} />
          <DetailField label="Entry Load" value={scheme.entryLoad} />
          <DetailField label="Exit Load" value={scheme.exitLoad} />
          {scheme.nfo.startDate ? (
            <>
              <DetailField label="NFO Start" value={scheme.nfo.startDate} />
              <DetailField label="NFO End" value={scheme.nfo.endDate} />
              <DetailField label="NFO Allotment" value={scheme.nfo.allotmentDate} />
              <DetailField label="NFO Reopen" value={scheme.nfo.reopenDate} />
            </>
          ) : null}
          {scheme.documents.offerDocumentUrl ? (
            <div className={styles.detailField}>
              <span>Offer Document URL</span>
              <Link href={scheme.documents.offerDocumentUrl} target="_blank" rel="noreferrer">
                {scheme.documents.offerDocumentUrl}
              </Link>
            </div>
          ) : null}
        </DetailSection>

        <DetailSection title="Plan Identifiers">
          <DetailField label="ISIN" value={scheme.identifiers.isin} />
          <DetailField label="RTA Identifier" value={scheme.identifiers.rta} />
          <DetailField label="AMFI Identifier" value={scheme.identifiers.amfi} />
        </DetailSection>

        <DetailSection title="Plan Options">
          <DetailField label="Plan" value={formatText(scheme.plan)} />
          <DetailField label="Option" value={formatText(scheme.option)} />
          <DetailField label="IDCW Option" value={formatText(scheme.idcwOption)} />
        </DetailSection>

        <section className={styles.fulfillmentSection}>
          <h3>Fulfillments</h3>
          <div className={styles.fulfillmentList}>
            {scheme.fulfillmentDetails.map((fulfillment) => (
              <article className={styles.fulfillmentCard} key={fulfillment.id || fulfillment.label}>
                <div className={styles.fulfillmentHeader}>
                  <div>
                    <h4>{fulfillment.label}</h4>
                    {fulfillment.type ? <p>{fulfillment.type}</p> : null}
                  </div>
                  {fulfillment.frequency ? <Chip label={fulfillment.frequency} size="small" /> : null}
                </div>
                {fulfillment.thresholds.length ? (
                  <div className={styles.thresholdGrid}>
                    {fulfillment.thresholds.map((threshold, index) => (
                      <DetailField
                        key={`${threshold.source}-${threshold.label}-${index}`}
                        label={threshold.label}
                        value={threshold.value}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    ) : null}
  </Drawer>
);

const CatalogueSearch = () => {
  const navigate = useNavigate();
  const searchPollTimeoutRef = useRef<number | undefined>();
  const searchPollTokenRef = useRef(0);
  const [detailsScheme, setDetailsScheme] = useState<ParsedScheme | undefined>();
  const [confirmationScheme, setConfirmationScheme] = useState<ParsedScheme | undefined>();
  const [isSelectingScheme, setIsSelectingScheme] = useState(false);
  const [selectError, setSelectError] = useState<string | undefined>();
  const {
    categories,
    fulfillments,
    investorDetails,
    providers,
    realtimeEvents,
    schemes,
    searchError,
    searchStatus,
    searchTransactionId,
    transactionDetails,
    workbenchSession,
    recordRealtimeEvent,
    setCurrentStep,
    setSearchAcknowledged,
    setSearchCatalog,
    setSearchError,
    setSearchWaiting,
    setInvestmentTransactionId,
    setOnSelectPayload,
    setOriginalSelectTransactionId,
    setSelectedScheme,
    setWorkbenchSession,
    setWebsocketStatus,
    startSearchState,
    websocketStatus,
  } = useMfJourneyStore((state) => state);

  const { control, handleSubmit } = useForm<SearchFormValues>({
    defaultValues: defaultSearchValues,
  });

  useEffect(() => {
    const unsubscribeEvents = ondcSocketService.subscribe((event: OndcRealtimeEvent) => {
      handleOndcRealtimeEvent(event, {
        recordRealtimeEvent,
        setSearchCatalog,
        setSearchError,
      });
    });

    const unsubscribeStatus = ondcSocketService.subscribeStatus(setWebsocketStatus);

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, [recordRealtimeEvent, setSearchCatalog, setSearchError, setWebsocketStatus]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const session = {
      sessionId: url.searchParams.get('session_id') ?? undefined,
      flowId: url.searchParams.get('flow_id') ?? undefined,
      transactionId: url.searchParams.get('transaction_id') ?? undefined,
      subscriberUrl: url.searchParams.get('subscriber_url') ?? undefined,
    };
    if (session.sessionId || session.flowId || session.transactionId || session.subscriberUrl) {
      setWorkbenchSession(session);
    }
  }, [setWorkbenchSession]);

  useEffect(
    () => () => {
      if (searchPollTimeoutRef.current) {
        window.clearTimeout(searchPollTimeoutRef.current);
      }
      searchPollTokenRef.current += 1;
    },
    [],
  );

  const stopSearchPolling = () => {
    searchPollTokenRef.current += 1;
    if (searchPollTimeoutRef.current) {
      window.clearTimeout(searchPollTimeoutRef.current);
      searchPollTimeoutRef.current = undefined;
    }
  };

  const pollSearchStatus = (trackingId: string, startedAt: number, token: number) => {
    searchPollTimeoutRef.current = window.setTimeout(async () => {
      if (searchPollTokenRef.current !== token) {
        return;
      }
      if (Date.now() - startedAt >= SEARCH_TIMEOUT_MS) {
        setSearchError('Timed out waiting for ONDC catalogue response.');
        return;
      }

      try {
        const status = await getSearchStatus(trackingId);
        if (searchPollTokenRef.current !== token) {
          return;
        }
        if (status.status === 'completed') {
          if (!status.catalogue) {
            setSearchError('Search completed without a catalogue payload.');
            return;
          }
          setSearchCatalog(parseOnSearchCatalog(status.catalogue as OndcOnSearchPayload));
          return;
        }
        if (status.status === 'failed') {
          setSearchError(status.error || 'ONDC search failed.');
          return;
        }
        pollSearchStatus(trackingId, startedAt, token);
      } catch (error) {
        setSearchError(error instanceof Error ? error.message : 'Unable to read search status.');
      }
    }, SEARCH_POLL_INTERVAL_MS);
  };

  const startSearch = async (values: SearchFormValues) => {
    try {
      stopSearchPolling();
      ondcSocketService.disconnect();
      startSearchState();
      const payload: SchemeSearchParams = {
        intent: 'mutual funds',
        category: values.category,
        provider_id: '',
        session_id: workbenchSession?.sessionId,
        subscriber_url: workbenchSession?.subscriberUrl,
        raw_overrides: {},
      };
      const response = await searchSchemes(payload);
      if (!response.success || !response.transaction_id) {
        throw new Error('Search request was not accepted by backend.');
      }
      setSearchAcknowledged(response.transaction_id);
      ondcSocketService.connect(response.transaction_id);
      window.setTimeout(setSearchWaiting, 650);
      if (!response.tracking_id) {
        throw new Error('Search tracking id was not returned by backend.');
      }
      const token = searchPollTokenRef.current;
      pollSearchStatus(response.tracking_id, Date.now(), token);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Unable to start ONDC search.');
    }
  };

  const requestSchemeSelection = (scheme: ParsedScheme) => {
    setConfirmationScheme(scheme);
  };

  const confirmSchemeSelection = async () => {
    if (!confirmationScheme) {
      return;
    }

    const scheme = confirmationScheme;
    const investmentTransactionId = createTransactionId();
    const fulfillmentType = defaultFulfillmentType(scheme);
    let onSelectReceived: ReturnType<typeof waitForOnSelect> | undefined;

    try {
      setSelectError(undefined);
      setIsSelectingScheme(true);
      console.log('First Select Transaction', investmentTransactionId);
      setOriginalSelectTransactionId(investmentTransactionId);
      setInvestmentTransactionId(investmentTransactionId);
      ondcSocketService.connect(investmentTransactionId);
      onSelectReceived = waitForOnSelect(investmentTransactionId);
      const response = await selectScheme(scheme, investmentTransactionId, {
        amount: transactionDetails.amount,
        arn: 'ARN-000000',
        customerPan: investorDetails.pan,
        euin: '',
        fulfillmentId: fulfillmentIdForType(scheme, fulfillmentType),
        fulfillmentType,
        subBrokerArn: '',
      });
      setSelectedScheme(scheme, mapSchemeToSelection(scheme), response.data);
      setCurrentStep(2);
      setConfirmationScheme(undefined);
      setDetailsScheme(undefined);
      navigate(`/transaction-setup?transaction_id=${encodeURIComponent(investmentTransactionId)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onSelectReceived.promise
        .then((onSelectEvent) => {
          setOnSelectPayload(onSelectEvent.payload);
        })
        .catch((error) => {
          setSelectError(error instanceof Error ? error.message : 'Timed out waiting for ONDC /on_select callback.');
        });
      onSelectReceived = undefined;
    } catch (error) {
      onSelectReceived?.cancel();
      setSelectError(error instanceof Error ? error.message : 'Unable to send ONDC /select.');
    } finally {
      setIsSelectingScheme(false);
    }
  };

  const isLoading =
    searchStatus === 'SEARCHING' || searchStatus === 'ACK_RECEIVED' || searchStatus === 'WAITING_FOR_ON_SEARCH';

  return (
    <div className={styles.page}>
      <Card className={pageStyles.panel}>
        <CardContent className={pageStyles.content}>
          <form className={styles.searchbar} onSubmit={handleSubmit(startSearch)}>
            <FormField control={control} name="category" label="Category" options={categoryOptions} />
            <Button type="submit" variant="contained" startIcon={<SearchIcon />} disabled={isLoading}>
              {searchStatus === 'ERROR' ? 'Retry' : 'Search Funds'}
            </Button>
          </form>

          {searchStatus !== 'IDLE' ? (
            <div className={styles.statePanel}>
              {isLoading ? <CircularProgress size={22} /> : null}
              <strong>
                {searchStatus === 'SEARCHING' ? 'Searching ONDC Network...' : null}
                {searchStatus === 'ACK_RECEIVED' ? 'Request accepted by ONDC' : null}
                {searchStatus === 'WAITING_FOR_ON_SEARCH' ? 'Waiting for catalogue response...' : null}
                {searchStatus === 'CATALOG_RECEIVED' ? 'Catalogue received' : null}
                {searchStatus === 'ERROR' ? 'Search failed' : null}
              </strong>
            </div>
          ) : null}

          {searchError ? (
            <Alert severity={searchStatus === 'CATALOG_RECEIVED' ? 'warning' : 'error'} className={styles.alert}>
              {searchError}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className={pageStyles.panel}>
        <CardContent className={pageStyles.content}>
          <DeveloperPanel
            transactionId={searchTransactionId}
            websocketStatus={websocketStatus}
            providerCount={providers.length}
            categoryCount={categories.length}
            fulfillmentCount={fulfillments.length}
            realtimeEvents={realtimeEvents}
          />
        </CardContent>
      </Card>

      <div className={styles.schemes}>
        {schemes.map((scheme) => (
          <SchemeCard key={scheme.id} scheme={scheme} onSelect={requestSchemeSelection} onViewDetails={setDetailsScheme} />
        ))}

        {searchStatus === 'CATALOG_RECEIVED' && schemes.length === 0 ? (
          <Alert severity="warning">ONDC catalogue received, but no items were present in the payload.</Alert>
        ) : null}
      </div>

      <DetailsDrawer scheme={detailsScheme} onClose={() => setDetailsScheme(undefined)} onSelect={requestSchemeSelection} />

      <Dialog open={Boolean(confirmationScheme)} onClose={() => setConfirmationScheme(undefined)} fullWidth maxWidth="xs">
        <DialogTitle>Confirm Scheme</DialogTitle>
        <DialogContent>
          <div>
            <strong>{confirmationScheme?.name}</strong>
            {confirmationScheme?.amcName ? <span>{confirmationScheme.amcName}</span> : null}
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmationScheme(undefined)} disabled={isSelectingScheme}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmSchemeSelection} disabled={isSelectingScheme}>
            {isSelectingScheme ? 'Selecting...' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(selectError)} autoHideDuration={6000} onClose={() => setSelectError(undefined)}>
        <Alert severity="error" onClose={() => setSelectError(undefined)}>
          {selectError}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default CatalogueSearch;
