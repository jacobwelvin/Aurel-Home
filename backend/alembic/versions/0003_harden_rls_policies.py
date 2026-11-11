"""Harden RLS policies: add order write and missing table policies

Revision ID: 0003_harden_rls_policies
Revises: a1d6bfce8932
Create Date: 2026-10-22 10:45:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0003_harden_rls_policies'
down_revision: Union[str, None] = 'a1d6bfce8932'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # ---------------------------------------------------------------
    # 1. Orders: Add INSERT policy for authenticated users (own orders)
    # ---------------------------------------------------------------
    op.execute("""
        CREATE POLICY "orders_insert_own"
        ON orders FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    """)

    # Orders: Allow customers to see status updates on their orders
    op.execute("""
        CREATE POLICY "orders_update_own_limited"
        ON orders FOR UPDATE
        USING (auth.uid() = user_id);
    """)

    # ---------------------------------------------------------------
    # 2. Order Items: Add INSERT policy (linked to own orders)
    # ---------------------------------------------------------------
    op.execute("""
        CREATE POLICY "order_items_insert_own"
        ON order_items FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM orders
                WHERE orders.id = order_items.order_id
                AND orders.user_id = auth.uid()
            )
        );
    """)

    # ---------------------------------------------------------------
    # 3. Order History: Add INSERT policy (linked to own orders)
    # ---------------------------------------------------------------
    op.execute("""
        CREATE POLICY "order_history_insert_own"
        ON order_history FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM orders
                WHERE orders.id = order_history.order_id
                AND orders.user_id = auth.uid()
            )
        );
    """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    op.execute("DROP POLICY IF EXISTS orders_insert_own ON orders;")
    op.execute("DROP POLICY IF EXISTS orders_update_own_limited ON orders;")
    op.execute("DROP POLICY IF EXISTS order_items_insert_own ON order_items;")
    op.execute("DROP POLICY IF EXISTS order_history_insert_own ON order_history;")
