import uuid
from datetime import datetime
from sqlalchemy import DateTime, String, Text, JSON, func, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OndcTransactionLog(Base):
    __tablename__ = 'ondc_transaction_logs'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action: Mapped[str] = mapped_column(String(50), index=True)
    direction: Mapped[str] = mapped_column(String(20), index=True)  # inbound/outbound
    transaction_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    subscriber_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default='RECEIVED')
    payload: Mapped[dict] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_ondc_txn_action_msg', 'transaction_id', 'message_id', 'action'),
        UniqueConstraint('action', 'direction', 'transaction_id', 'message_id', name='uq_ondc_action_direction_txn_msg'),
    )
