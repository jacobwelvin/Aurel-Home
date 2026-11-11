import pytest
import uuid
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.models.order import Order, OrderItem


def test_user_creation_and_cart_relationship(db_session: Session):
    user = User(
        name="Elena Rostova",
        email="elena.rostova@atelier.example.com",
    )
    db_session.add(user)
    db_session.commit()
    assert user.id is not None

    cart = Cart(user_id=user.id)
    db_session.add(cart)
    db_session.commit()

    assert cart.user.email == "elena.rostova@atelier.example.com"
    assert len(user.carts) == 1


def test_cart_item_quantity_and_product_relationship(db_session: Session):
    category = Category(
        name="Textiles",
        slug=f"textiles-{uuid.uuid4().hex[:6]}",
    )
    db_session.add(category)
    db_session.commit()

    product = Product(
        name="Washed Linen Duvet",
        slug=f"washed-linen-duvet-{uuid.uuid4().hex[:6]}",
        price=Decimal("18500.00"),
        stock=15,
        images=["https://example.com/duvet.jpg"],
        category_id=category.id,
    )
    db_session.add(product)
    db_session.commit()

    cart = Cart()
    db_session.add(cart)
    db_session.commit()

    item = CartItem(
        cart_id=cart.id,
        product_id=product.id,
        quantity=2,
        selected_color="Natural Flax",
    )
    db_session.add(item)
    db_session.commit()

    assert item.product.name == "Washed Linen Duvet"
    assert item.quantity == 2
    assert len(cart.items) == 1


def test_order_and_order_item_financial_snapshots(db_session: Session):
    user = User(
        name="Kenji Takahashi",
        email="kenji.takahashi@atelier.example.com",
    )
    db_session.add(user)
    db_session.commit()

    category = Category(
        name="Furniture",
        slug=f"furniture-{uuid.uuid4().hex[:6]}",
    )
    db_session.add(category)
    db_session.commit()

    product = Product(
        name="Soren Lounge Chair",
        slug=f"soren-{uuid.uuid4().hex[:6]}",
        price=Decimal("48900.00"),
        stock=5,
        images=["https://example.com/soren.jpg"],
        category_id=category.id,
    )
    db_session.add(product)
    db_session.commit()

    order = Order(
        order_number=f"AH-{uuid.uuid4().hex[:8].upper()}",
        user_id=user.id,
        status="Confirmed",
        subtotal=Decimal("48900.00"),
        shipping_amount=Decimal("0.00"),
        total_amount=Decimal("48900.00"),
        shipping_address={"city": "Kyoto", "country": "Japan"},
        payment_method="Wire Transfer",
    )
    db_session.add(order)
    db_session.commit()

    order_item = OrderItem(
        order_id=order.id,
        product_id=product.id,
        product_name_snapshot="Soren Lounge Chair - Kyoto Edition",
        quantity=1,
        unit_price=Decimal("48900.00"),
        line_total=Decimal("48900.00"),
    )
    db_session.add(order_item)
    db_session.commit()

    assert len(order.items) == 1
    assert order.items[0].product_name_snapshot == "Soren Lounge Chair - Kyoto Edition"
    assert order.user.name == "Kenji Takahashi"


def test_duplicate_user_email_constraint(db_session: Session):
    u1 = User(name="User 1", email="duplicate@example.com")
    db_session.add(u1)
    db_session.commit()

    u2 = User(name="User 2", email="duplicate@example.com")
    db_session.add(u2)
    with pytest.raises(IntegrityError):
        db_session.commit()
