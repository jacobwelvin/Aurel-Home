"""Add user role column and enable Row Level Security (RLS)

Revision ID: 0002_user_role_and_rls
Revises: 0001_initial_schema
Create Date: 2026-10-17 16:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_user_role_and_rls'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add role column to users table
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=50), nullable=False, server_default='customer')
    )
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)

    # 2. Configure Row Level Security (RLS) on PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        # Enable RLS on all public tables
        tables = ['categories', 'products', 'users', 'carts', 'cart_items', 'orders', 'order_items']
        for table in tables:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")

        # RLS Policies for Categories
        op.execute("""
            CREATE POLICY "categories_public_read" 
            ON categories FOR SELECT 
            USING (true);
        """)

        # RLS Policies for Products
        op.execute("""
            CREATE POLICY "products_public_read_active" 
            ON products FOR SELECT 
            USING (active = true);
        """)

        # RLS Policies for Users (Profile security)
        op.execute("""
            CREATE POLICY "users_read_own_profile" 
            ON users FOR SELECT 
            USING (auth.uid() = id);
        """)
        op.execute("""
            CREATE POLICY "users_update_own_profile" 
            ON users FOR UPDATE 
            USING (auth.uid() = id);
        """)
        op.execute("""
            CREATE POLICY "users_insert_own_profile" 
            ON users FOR INSERT 
            WITH CHECK (auth.uid() = id);
        """)

        # RLS Policies for Carts
        op.execute("""
            CREATE POLICY "carts_manage_own_cart" 
            ON carts FOR ALL 
            USING (auth.uid() = user_id);
        """)

        # RLS Policies for Cart Items
        op.execute("""
            CREATE POLICY "cart_items_manage_own" 
            ON cart_items FOR ALL 
            USING (
                EXISTS (
                    SELECT 1 FROM carts 
                    WHERE carts.id = cart_items.cart_id 
                    AND carts.user_id = auth.uid()
                )
            );
        """)

        # RLS Policies for Orders
        op.execute("""
            CREATE POLICY "orders_read_own" 
            ON orders FOR SELECT 
            USING (auth.uid() = user_id);
        """)

        # RLS Policies for Order Items
        op.execute("""
            CREATE POLICY "order_items_read_own" 
            ON order_items FOR SELECT 
            USING (
                EXISTS (
                    SELECT 1 FROM orders 
                    WHERE orders.id = order_items.order_id 
                    AND orders.user_id = auth.uid()
                )
            );
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        # Drop policies
        op.execute("DROP POLICY IF EXISTS categories_public_read ON categories;")
        op.execute("DROP POLICY IF EXISTS products_public_read_active ON products;")
        op.execute("DROP POLICY IF EXISTS users_read_own_profile ON users;")
        op.execute("DROP POLICY IF EXISTS users_update_own_profile ON users;")
        op.execute("DROP POLICY IF EXISTS users_insert_own_profile ON users;")
        op.execute("DROP POLICY IF EXISTS carts_manage_own_cart ON carts;")
        op.execute("DROP POLICY IF EXISTS cart_items_manage_own ON cart_items;")
        op.execute("DROP POLICY IF EXISTS orders_read_own ON orders;")
        op.execute("DROP POLICY IF EXISTS order_items_read_own ON order_items;")

        tables = ['categories', 'products', 'users', 'carts', 'cart_items', 'orders', 'order_items']
        for table in tables:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_column('users', 'role')
