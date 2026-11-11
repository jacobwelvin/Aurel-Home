"""Add original_payment_method, invoice_number, and paid_at to orders

Revision ID: 0005_cod_to_online_and_invoices
Revises: 0004_realtime_and_order_rls
Create Date: 2026-10-28 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005_cod_to_online_and_invoices'
down_revision: Union[str, None] = '0004_realtime_and_order_rls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'orders',
        sa.Column('original_payment_method', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'orders',
        sa.Column('invoice_number', sa.String(length=100), nullable=True)
    )
    op.create_index(
        op.f('ix_orders_invoice_number'),
        'orders',
        ['invoice_number'],
        unique=True
    )
    op.add_column(
        'orders',
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_orders_invoice_number'), table_name='orders')
    op.drop_column('orders', 'paid_at')
    op.drop_column('orders', 'invoice_number')
    op.drop_column('orders', 'original_payment_method')
