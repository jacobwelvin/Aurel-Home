"""add_order_fulfilment_and_history

Revision ID: a1d6bfce8932
Revises: 0002_user_role_and_rls
Create Date: 2026-10-19 09:07:59.337688

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1d6bfce8932'
down_revision: Union[str, None] = '0002_user_role_and_rls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add payment_status, payment_reference, and carrier to orders
    op.add_column(
        'orders',
        sa.Column('payment_status', sa.String(length=50), nullable=False, server_default='Pending')
    )
    op.create_index(op.f('ix_orders_payment_status'), 'orders', ['payment_status'], unique=False)

    op.add_column(
        'orders',
        sa.Column('payment_reference', sa.String(length=255), nullable=True)
    )

    op.add_column(
        'orders',
        sa.Column('carrier', sa.String(length=100), nullable=True)
    )

    # 2. Create order_history audit log table
    op.create_table(
        'order_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('previous_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('action_by', sa.String(length=255), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_history_order_id'), 'order_history', ['order_id'], unique=False)

    # Enable RLS on order_history if postgresql
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY "order_history_read_own" 
            ON order_history FOR SELECT 
            USING (
                EXISTS (
                    SELECT 1 FROM orders 
                    WHERE orders.id = order_history.order_id 
                    AND orders.user_id = auth.uid()
                )
            );
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP POLICY IF EXISTS order_history_read_own ON order_history;")

    op.drop_index(op.f('ix_order_history_order_id'), table_name='order_history')
    op.drop_table('order_history')

    op.drop_column('orders', 'carrier')
    op.drop_column('orders', 'payment_reference')
    op.drop_index(op.f('ix_orders_payment_status'), table_name='orders')
    op.drop_column('orders', 'payment_status')
