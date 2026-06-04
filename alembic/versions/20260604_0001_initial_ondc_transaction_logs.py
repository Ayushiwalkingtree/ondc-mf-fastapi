"""initial ondc transaction logs

Revision ID: 20260604_0001
Revises:
Create Date: 2026-06-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '20260604_0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ondc_transaction_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('direction', sa.String(length=20), nullable=False),
        sa.Column('transaction_id', sa.String(length=100), nullable=True),
        sa.Column('message_id', sa.String(length=100), nullable=True),
        sa.Column('subscriber_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'action',
            'direction',
            'transaction_id',
            'message_id',
            name='uq_ondc_action_direction_txn_msg',
        ),
    )
    op.create_index(op.f('ix_ondc_transaction_logs_action'), 'ondc_transaction_logs', ['action'])
    op.create_index(op.f('ix_ondc_transaction_logs_direction'), 'ondc_transaction_logs', ['direction'])
    op.create_index(op.f('ix_ondc_transaction_logs_message_id'), 'ondc_transaction_logs', ['message_id'])
    op.create_index(
        op.f('ix_ondc_transaction_logs_transaction_id'),
        'ondc_transaction_logs',
        ['transaction_id'],
    )
    op.create_index(
        'ix_ondc_txn_action_msg',
        'ondc_transaction_logs',
        ['transaction_id', 'message_id', 'action'],
    )


def downgrade() -> None:
    op.drop_index('ix_ondc_txn_action_msg', table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_transaction_id'), table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_message_id'), table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_direction'), table_name='ondc_transaction_logs')
    op.drop_index(op.f('ix_ondc_transaction_logs_action'), table_name='ondc_transaction_logs')
    op.drop_table('ondc_transaction_logs')
