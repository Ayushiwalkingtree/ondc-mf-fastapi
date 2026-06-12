"""add mf search request states

Revision ID: 20260612_0003
Revises: 20260608_0002
Create Date: 2026-06-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260612_0003'
down_revision: Union[str, None] = '20260608_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mf_search_request_states',
        sa.Column('tracking_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('transaction_id', sa.String(length=100), nullable=True),
        sa.Column('message_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('request_payload', sa.JSON(), nullable=False),
        sa.Column('catalogue', sa.JSON(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('subscriber_url', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('tracking_id'),
    )
    op.create_index(
        op.f('ix_mf_search_request_states_transaction_id'),
        'mf_search_request_states',
        ['transaction_id'],
    )
    op.create_index(
        op.f('ix_mf_search_request_states_status'),
        'mf_search_request_states',
        ['status'],
    )
    op.create_index(
        op.f('ix_mf_search_request_states_session_id'),
        'mf_search_request_states',
        ['session_id'],
    )
    op.create_index(
        'ix_mf_search_state_tracking_status',
        'mf_search_request_states',
        ['tracking_id', 'status'],
    )
    op.create_index(
        'ix_mf_search_state_active_session',
        'mf_search_request_states',
        ['session_id', 'status', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_mf_search_state_active_session', table_name='mf_search_request_states')
    op.drop_index('ix_mf_search_state_tracking_status', table_name='mf_search_request_states')
    op.drop_index(op.f('ix_mf_search_request_states_session_id'), table_name='mf_search_request_states')
    op.drop_index(op.f('ix_mf_search_request_states_status'), table_name='mf_search_request_states')
    op.drop_index(op.f('ix_mf_search_request_states_transaction_id'), table_name='mf_search_request_states')
    op.drop_table('mf_search_request_states')
