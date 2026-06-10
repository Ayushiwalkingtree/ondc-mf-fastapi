import type { OndcRealtimeEvent } from '../types/ondc';
import type { OndcOnSearchPayload, ParsedCatalog } from '../types/scheme';
import { parseOnSearchCatalog } from '../utils/catalogParser';

interface OndcEventHandlerActions {
  recordRealtimeEvent: (event: OndcRealtimeEvent) => void;
  setSearchCatalog: (catalog: ParsedCatalog) => void;
  setSearchError: (error: string) => void;
}

export const handleOndcRealtimeEvent = (
  event: OndcRealtimeEvent,
  actions: OndcEventHandlerActions,
): void => {
  actions.recordRealtimeEvent(event);

  switch (event.event) {
    case 'ON_SEARCH_RECEIVED': {
      try {
        actions.setSearchCatalog(parseOnSearchCatalog(event.payload as OndcOnSearchPayload));
      } catch (error) {
        actions.setSearchError(error instanceof Error ? error.message : 'Malformed catalog received.');
      }
      return;
    }
    case 'ON_SELECT_RECEIVED':
    case 'ON_INIT_RECEIVED':
    case 'ON_CONFIRM_RECEIVED':
    case 'ON_STATUS_RECEIVED':
    case 'ON_UPDATE_RECEIVED':
      return;
    default:
      actions.setSearchError(`Unsupported realtime event received: ${event.event}`);
  }
};
