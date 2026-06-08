-- Local PostgreSQL schema for the current ONDC MF FastAPI codebase.
-- The application architecture stores Search, On_Search, Select, On_Select,
-- callbacks, outbound requests, and ACK responses in this single audit table.

CREATE TABLE IF NOT EXISTS ondc_transaction_logs (
    id UUID PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    transaction_id VARCHAR(100),
    message_id VARCHAR(100),
    subscriber_id VARCHAR(255),
    provider_id VARCHAR(255),
    item_id VARCHAR(100),
    fulfillment_id VARCHAR(100),
    bpp_id VARCHAR(255),
    bpp_uri TEXT,
    status VARCHAR(30) NOT NULL,
    payload JSON NOT NULL,
    raw_payload JSON,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ondc_action_direction_txn_msg
        UNIQUE (action, direction, transaction_id, message_id)
);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_action
    ON ondc_transaction_logs (action);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_direction
    ON ondc_transaction_logs (direction);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_transaction_id
    ON ondc_transaction_logs (transaction_id);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_message_id
    ON ondc_transaction_logs (message_id);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_provider_id
    ON ondc_transaction_logs (provider_id);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_item_id
    ON ondc_transaction_logs (item_id);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_fulfillment_id
    ON ondc_transaction_logs (fulfillment_id);

CREATE INDEX IF NOT EXISTS ix_ondc_transaction_logs_bpp_id
    ON ondc_transaction_logs (bpp_id);

CREATE INDEX IF NOT EXISTS ix_ondc_txn_action_msg
    ON ondc_transaction_logs (transaction_id, message_id, action);

CREATE INDEX IF NOT EXISTS ix_ondc_txn_discovery_lookup
    ON ondc_transaction_logs (transaction_id, action, direction, status, provider_id);

CREATE INDEX IF NOT EXISTS ix_ondc_txn_select_lookup
    ON ondc_transaction_logs (transaction_id, provider_id, item_id, fulfillment_id);
