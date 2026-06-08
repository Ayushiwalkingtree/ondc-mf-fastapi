"""add ondc log metadata columns

Revision ID: 20260608_0002
Revises: 20260604_0001
Create Date: 2026-06-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260608_0002'
down_revision: Union[str, None] = '20260604_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ondc_transaction_logs', sa.Column('provider_id', sa.String(length=255), nullable=True))
    op.add_column('ondc_transaction_logs', sa.Column('item_id', sa.String(length=100), nullable=True))
    op.add_column('ondc_transaction_logs', sa.Column('fulfillment_id', sa.String(length=100), nullable=True))
    op.add_column('ondc_transaction_logs', sa.Column('bpp_id', sa.String(length=255), nullable=True))
    op.add_column('ondc_transaction_logs', sa.Column('bpp_uri', sa.Text(), nullable=True))
    op.add_column('ondc_transaction_logs', sa.Column('raw_payload', sa.JSON(), nullable=True))
    op.execute('UPDATE ondc_transaction_logs SET raw_payload = payload WHERE raw_payload IS NULL')

    op.create_index(op.f('ix_ondc_transaction_logs_provider_id'), 'ondc_transaction_logs', ['provider_id'])
    op.create_index(op.f('ix_ondc_transaction_logs_item_id'), 'ondc_transaction_logs', ['item_id'])
    op.create_index(op.f('ix_ondc_transaction_logs_fulfillment_id'), 'ondc_transaction_logs', ['fulfillment_id'])
    op.create_index(op.f('ix_ondc_transaction_logs_bpp_id'), 'ondc_transaction_logs', ['bpp_id'])
    op.create_index(
        'ix_ondc_txn_discovery_lookup',
        'ondc_transaction_logs',
        ['transaction_id', 'action', 'direction', 'status', 'provider_id'],
    )
    op.create_index(
        'ix_ondc_txn_select_lookup',
        'ondc_transaction_logs',
        ['transaction_id', 'provider_id', 'item_id', 'fulfillment_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_ondc_txn_select_lookup', table_name='ondc_transaction_logs')
    op.drop_index('ix_ondc_txn_discovery_lookup', table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_bpp_id'), table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_fulfillment_id'), table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_item_id'), table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_provider_id'), table_name='ondc_transaction_logs')
    op.drop_column('ondc_transaction_logs', 'raw_payload')
    op.drop_column('ondc_transaction_logs', 'bpp_uri')
    op.drop_column('ondc_transaction_logs', 'bpp_id')
    op.drop_column('ondc_transaction_logs', 'fulfillment_id')
    op.drop_column('ondc_transaction_logs', 'item_id')
    op.drop_column('ondc_transaction_logs', 'provider_id')
