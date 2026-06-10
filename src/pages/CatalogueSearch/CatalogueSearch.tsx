import SearchIcon from '@mui/icons-material/Search';
import { Alert, Button, Card, CardContent, CircularProgress } from '@mui/material';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import DeveloperPanel from '../../components/DeveloperPanel/DeveloperPanel';
import FormField from '../../components/FormField/FormField';
import type { FieldOption } from '../../components/FormField/FormField';
import SchemeCard from '../../components/SchemeCard/SchemeCard';
import { handleOndcRealtimeEvent } from '../../services/ondcEventHandler';
import { ondcSocketService } from '../../services/ondcSocket.service';
import { searchSchemes } from '../../services/search.service';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import type { OndcRealtimeEvent } from '../../types/ondc';
import type { ParsedScheme, SchemeSearchParams } from '../../types/scheme';
import { mapSchemeToSelection } from '../../utils/schemeMapper';
import pageStyles from '../page.module.scss';
import styles from './CatalogueSearch.module.scss';

interface SearchFormValues {
  category: string;
}

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

const CatalogueSearch = () => {
  const navigate = useNavigate();
  const {
    categories,
    fulfillments,
    providers,
    realtimeEvents,
    schemes,
    searchError,
    searchStatus,
    searchTransactionId,
    recordRealtimeEvent,
    setCurrentStep,
    setSearchAcknowledged,
    setSearchCatalog,
    setSearchError,
    setSearchWaiting,
    setSelectedScheme,
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

  const startSearch = async (values: SearchFormValues) => {
    try {
      ondcSocketService.disconnect();
      startSearchState();
      const payload: SchemeSearchParams = {
        intent: 'mutual funds',
        category: values.category,
        provider_id: '',
        raw_overrides: {},
      };
      const response = await searchSchemes(payload);
      if (!response.success || !response.transaction_id) {
        throw new Error('Search request was not accepted by backend.');
      }
      setSearchAcknowledged(response.transaction_id);
      ondcSocketService.connect(response.transaction_id);
      window.setTimeout(setSearchWaiting, 650);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Unable to start ONDC search.');
    }
  };

  const selectScheme = (scheme: ParsedScheme) => {
    setSelectedScheme(scheme, mapSchemeToSelection(scheme));
    setCurrentStep(2);
    navigate('/transaction-setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <SchemeCard key={scheme.id} scheme={scheme} onSelect={selectScheme} />
        ))}

        {searchStatus === 'CATALOG_RECEIVED' && schemes.length === 0 ? (
          <Alert severity="warning">ONDC catalogue received, but no items were present in the payload.</Alert>
        ) : null}
      </div>
    </div>
  );
};

export default CatalogueSearch;
