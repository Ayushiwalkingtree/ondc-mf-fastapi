import BugReportIcon from '@mui/icons-material/BugReport';
import { Button, Collapse, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import type { OndcRealtimeEvent, WebSocketStatus } from '../../types/ondc';
import styles from './DeveloperPanel.module.scss';

interface DeveloperPanelProps {
  transactionId?: string;
  websocketStatus: WebSocketStatus;
  providerCount: number;
  categoryCount: number;
  fulfillmentCount: number;
  realtimeEvents: OndcRealtimeEvent[];
}

const summarizeEvent = (event?: OndcRealtimeEvent) => {
  if (!event) {
    return 'No callback received yet.';
  }

  const payload = event.payload as { context?: Record<string, unknown>; message?: Record<string, unknown> };
  const catalog = payload.message?.catalog as { providers?: unknown[] } | undefined;

  return JSON.stringify(
    {
      event: event.event,
      transaction_id: event.transaction_id,
      action: payload.context?.action,
      message_id: payload.context?.message_id,
      provider_count: Array.isArray(catalog?.providers) ? catalog.providers.length : undefined,
      payload_keys: Object.keys((event.payload as Record<string, unknown>) ?? {}),
    },
    null,
    2,
  );
};

const DeveloperPanel = ({
  transactionId,
  websocketStatus,
  providerCount,
  categoryCount,
  fulfillmentCount,
  realtimeEvents,
}: DeveloperPanelProps) => {
  const [open, setOpen] = useState(false);
  const callbackSummary = useMemo(() => summarizeEvent(realtimeEvents[0]), [realtimeEvents]);

  return (
    <div className={styles.panel}>
      <Button
        className={styles.toggle}
        variant="outlined"
        size="small"
        startIcon={<BugReportIcon />}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide Debug Info' : 'Show Debug Info'}
      </Button>

      <Collapse in={open}>
        <div className={styles.content}>
          <div className={styles.grid}>
            <TextField label="transaction_id" value={transactionId ?? '-'} InputProps={{ readOnly: true }} />
            <TextField label="websocket_status" value={websocketStatus} InputProps={{ readOnly: true }} />
            <TextField label="provider_count" value={providerCount} InputProps={{ readOnly: true }} />
            <TextField label="category_count" value={categoryCount} InputProps={{ readOnly: true }} />
            <TextField label="fulfillment_count" value={fulfillmentCount} InputProps={{ readOnly: true }} />
          </div>
          <pre className={styles.summary}>{callbackSummary}</pre>
        </div>
      </Collapse>
    </div>
  );
};

export default DeveloperPanel;
