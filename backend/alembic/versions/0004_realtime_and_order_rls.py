"""Add order idempotency key, enable Realtime publication, and strengthen order RLS

Revision ID: 0004_realtime_and_order_rls
Revises: 0003_harden_rls_policies
Create Date: 2026-10-23 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_realtime_and_order_rls'
down_revision: Union[str, None] = '0003_harden_rls_policies'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add idempotency_key column to orders table
    op.add_column(
        'orders',
        sa.Column('idempotency_key', sa.String(length=128), nullable=True)
    )
    op.create_index(
        op.f('ix_orders_idempotency_key'),
        'orders',
        ['idempotency_key'],
        unique=True
    )

    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # 2. Ensure order_history has RLS enabled
    op.execute("ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;")

    # 3. Add administrator bypass policies for all order tables
    op.execute("""
        DROP POLICY IF EXISTS "orders_admin_all" ON orders;
        CREATE POLICY "orders_admin_all"
        ON orders FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
        );
    """)

    op.execute("""
        DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
        CREATE POLICY "order_items_admin_all"
        ON order_items FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
        );
    """)

    op.execute("""
        DROP POLICY IF EXISTS "order_history_read_own" ON order_history;
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

    op.execute("""
        DROP POLICY IF EXISTS "order_history_admin_all" ON order_history;
        CREATE POLICY "order_history_admin_all"
        ON order_history FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
        );
    """)

    # 4. Set replica identity on orders for realtime change capture
    op.execute("ALTER TABLE orders REPLICA IDENTITY FULL;")

    # 5. Add orders table to supabase_realtime publication
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_publication_tables 
                    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
                ) THEN
                    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_publication_tables 
                    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
                ) THEN
                    ALTER PUBLICATION supabase_realtime DROP TABLE orders;
                END IF;
            END $$;
        """)
        op.execute("DROP POLICY IF EXISTS orders_admin_all ON orders;")
        op.execute("DROP POLICY IF EXISTS order_items_admin_all ON order_items;")
        op.execute("DROP POLICY IF EXISTS order_history_read_own ON order_history;")
        op.execute("DROP POLICY IF EXISTS order_history_admin_all ON order_history;")

    op.drop_index(op.f('ix_orders_idempotency_key'), table_name='orders')
    op.drop_column('orders', 'idempotency_key')
