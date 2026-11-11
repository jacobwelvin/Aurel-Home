import io
import os
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    NextPageTemplate,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.models.order import Order, OrderHistory
from app.models.user import User
from app.services.order_service import OrderService

logger = logging.getLogger("aurel.invoice")

# Business entity constants
BUSINESS_NAME = "Aurel Home Atelier"
BUSINESS_LEGAL_NAME = "Aurel Home Atelier Private Limited"
BUSINESS_GSTIN = "27AABCA1234F1Z8"
BUSINESS_ADDRESS_LINE1 = "Atelier 4, Industrial Design Estate, Worli,"
BUSINESS_ADDRESS_LINE2 = "Mumbai, Maharashtra - 400018, India"
BUSINESS_CONTACT = "concierge@aurelhome.com  |  +91 (022) 8921-2873"
BUSINESS_WEBSITE = "www.aurelhome.com"

# Palette matching the reference specification
INK = colors.HexColor("#1A1A1A")
RUST = colors.HexColor("#C4573A")
GREEN = colors.HexColor("#0F9D6B")
GREY = colors.HexColor("#6B6B6B")
CARD = colors.HexColor("#F7F7F7")
LINE = colors.HexColor("#E3E3E3")

W, H = A4
M = 20 * mm
CW = W - 2 * M  # 170 mm content width

_FONTS_REGISTERED = False


def _ensure_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return

    win = "C:/Windows/Fonts/"
    lib = "/usr/share/fonts/truetype/liberation/"
    djv = "/usr/share/fonts/truetype/dejavu/"

    if os.path.exists(f"{lib}LiberationSans-Regular.ttf"):
        pdfmetrics.registerFont(TTFont("LS", f"{lib}LiberationSans-Regular.ttf"))
        pdfmetrics.registerFont(TTFont("LSB", f"{lib}LiberationSans-Bold.ttf"))
        pdfmetrics.registerFont(TTFont("LSI", f"{lib}LiberationSans-Italic.ttf"))
        pdfmetrics.registerFont(TTFont("LSBI", f"{lib}LiberationSans-BoldItalic.ttf"))
    elif os.path.exists(f"{win}arial.ttf"):
        pdfmetrics.registerFont(TTFont("LS", f"{win}arial.ttf"))
        pdfmetrics.registerFont(TTFont("LSB", f"{win}arialbd.ttf"))
        pdfmetrics.registerFont(TTFont("LSI", f"{win}ariali.ttf"))
        pdfmetrics.registerFont(TTFont("LSBI", f"{win}arialbi.ttf"))
    elif os.path.exists(f"{win}segoeui.ttf"):
        pdfmetrics.registerFont(TTFont("LS", f"{win}segoeui.ttf"))
        pdfmetrics.registerFont(TTFont("LSB", f"{win}segoeuib.ttf"))
        pdfmetrics.registerFont(TTFont("LSI", f"{win}segoeuii.ttf"))
        pdfmetrics.registerFont(TTFont("LSBI", f"{win}segoeuiz.ttf"))

    if os.path.exists(f"{djv}DejaVuSans.ttf"):
        pdfmetrics.registerFont(TTFont("DJ", f"{djv}DejaVuSans.ttf"))
        pdfmetrics.registerFont(TTFont("DJB", f"{djv}DejaVuSans-Bold.ttf"))
    else:
        if os.path.exists(f"{win}arial.ttf"):
            pdfmetrics.registerFont(TTFont("DJ", f"{win}arial.ttf"))
            pdfmetrics.registerFont(TTFont("DJB", f"{win}arialbd.ttf"))
        elif os.path.exists(f"{win}segoeui.ttf"):
            pdfmetrics.registerFont(TTFont("DJ", f"{win}segoeui.ttf"))
            pdfmetrics.registerFont(TTFont("DJB", f"{win}segoeuib.ttf"))

    try:
        pdfmetrics.registerFontFamily("LS", normal="LS", bold="LSB", italic="LSI", boldItalic="LSBI")
    except Exception:
        pass

    _FONTS_REGISTERED = True


def inr(v: float) -> str:
    """Indian digit grouping: 1,24,900.00"""
    s = f"{v:,.2f}"
    whole, dec = s.replace(",", "").split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return f"{whole}.{dec}"


def R(v: float, bold: bool = False) -> str:
    return f'<font name="{"DJB" if bold else "DJ"}">\u20b9</font>{inr(v)}'


def kv_table(rows, widths, muted_style, body_style):
    """Label/value rows with a fixed label column so values line up."""
    t = Table([[Paragraph(k, muted_style), Paragraph(v, body_style)] for k, v in rows], colWidths=widths)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
    ]))
    return t


class InvoiceService:
    @staticmethod
    def get_invoice_data(
        db: Session,
        order_id: uuid.UUID,
        user: Optional[User] = None,
        email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validate order existence, permissions, and delivery fulfillment status.
        Ensures a unique persistent invoice number exists and returns structured invoice data.
        """
        order = OrderService.get_customer_order(db, str(order_id), user=user, email=email)

        # Enforce post-delivery requirement
        if order.status != "Delivered":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invoice is unavailable. Consignment {order.order_number} has not been marked as 'Delivered' "
                    f"(current status: '{order.status}'). Invoices are generated only after delivery is completed."
                ),
            )

        # Generate unique, persistent invoice number if not already present
        if not order.invoice_number:
            clean_num = order.order_number.replace("AUR-", "").replace("-IN", "")
            year = order.created_at.year if order.created_at else datetime.utcnow().year
            invoice_num = f"INV-{clean_num}-{year}"

            # Ensure uniqueness in unlikely collision
            existing = db.query(Order).filter(Order.invoice_number == invoice_num, Order.id != order.id).first()
            if existing:
                invoice_num = f"INV-{clean_num}-{uuid.uuid4().hex[:4].upper()}-{year}"

            order.invoice_number = invoice_num
            db.commit()
            db.refresh(order)

        # Delivery date resolution from audit history
        delivery_date_str = None
        for h in order.history:
            if h.new_status == "Delivered":
                delivery_date_str = h.created_at.strftime("%d %B %Y")
                break
        if not delivery_date_str:
            delivery_date_str = order.updated_at.strftime("%d %B %Y") if order.updated_at else datetime.utcnow().strftime("%d %B %Y")

        invoice_date_str = (order.updated_at or order.created_at or datetime.utcnow()).strftime("%d %B %Y")

        shipping = order.shipping_address or {}
        recipient_name = (
            shipping.get("fullName")
            or shipping.get("name")
            or (order.user.name if order.user else "Valued Patron")
        )
        recipient_email = shipping.get("email") or (order.user.email if order.user else "N/A")
        recipient_phone = shipping.get("phone") or "N/A"
        recipient_address = shipping.get("address") or ""
        recipient_apt = shipping.get("apartment") or ""
        recipient_city = shipping.get("city") or ""
        recipient_state = shipping.get("state") or ""
        recipient_pin = shipping.get("postalCode") or ""

        # Payment details & accurate status
        orig_pm = (order.original_payment_method or order.payment_method or "").lower()
        curr_pm = (order.payment_method or "").lower()
        is_paid = order.payment_status == "Paid"
        paid_online = (orig_pm == "cod" and (curr_pm != "cod" or order.razorpay_payment_id is not None) and is_paid)

        if paid_online:
            payment_display = "UPI (Razorpay)"
            payment_status_display = "PAID (ONLINE)"
        elif curr_pm == "cod" or orig_pm == "cod":
            if is_paid:
                payment_display = "Cash on Delivery"
                payment_status_display = "PAID (CASH ON DELIVERY)"
            else:
                payment_display = "Cash on Delivery"
                payment_status_display = "PAYMENT PENDING"
        elif curr_pm in ("upi", "razorpay"):
            payment_display = "UPI (Razorpay)"
            payment_status_display = "PAID (ONLINE)" if is_paid else "PAYMENT PENDING"
        elif curr_pm == "card":
            payment_display = "Card (Razorpay)"
            payment_status_display = "PAID (ONLINE)" if is_paid else "PAYMENT PENDING"
        elif curr_pm == "netbanking":
            payment_display = "NetBanking (Razorpay)"
            payment_status_display = "PAID (ONLINE)" if is_paid else "PAYMENT PENDING"
        else:
            payment_display = curr_pm.upper() if curr_pm else "Standard Protocol"
            payment_status_display = "PAID (ONLINE)" if is_paid else "PAYMENT PENDING"

        paid_at_str = order.paid_at.strftime("%d %B %Y") if order.paid_at else None

        items_list = []
        for it in (order.items or []):
            items_list.append({
                "product_name": it.product_name_snapshot,
                "quantity": it.quantity,
                "unit_price": float(it.unit_price),
                "line_total": float(it.line_total),
            })

        return {
            "invoice_number": order.invoice_number,
            "order_id": str(order.id),
            "order_number": order.order_number,
            "invoice_date": invoice_date_str,
            "delivery_date": delivery_date_str,
            "status": order.status,
            "payment_status": order.payment_status,
            "payment_status_display": payment_status_display,
            "payment_method": order.payment_method,
            "payment_display": payment_display,
            "original_payment_method": order.original_payment_method or orig_pm,
            "paid_online": paid_online,
            "payment_reference": order.payment_reference or order.razorpay_payment_id,
            "paid_at": paid_at_str,
            "business": {
                "name": BUSINESS_NAME,
                "legal_name": BUSINESS_LEGAL_NAME,
                "gstin": BUSINESS_GSTIN,
                "address_line1": BUSINESS_ADDRESS_LINE1,
                "address_line2": BUSINESS_ADDRESS_LINE2,
                "contact": BUSINESS_CONTACT,
                "website": BUSINESS_WEBSITE,
            },
            "recipient": {
                "full_name": recipient_name,
                "email": recipient_email,
                "phone": recipient_phone,
                "address": recipient_address,
                "apartment": recipient_apt,
                "city": recipient_city,
                "state": recipient_state,
                "postal_code": recipient_pin,
            },
            "items": items_list,
            "subtotal": float(order.subtotal),
            "shipping_amount": float(order.shipping_amount),
            "discount": 0.00,
            "total_amount": float(order.total_amount),
        }

    @staticmethod
    def generate_invoice_pdf(data: Dict[str, Any]) -> bytes:
        """
        Generate an exact visual match of the Aurel Home consignment invoice PDF reference.
        """
        _ensure_fonts()
        buffer = io.BytesIO()

        def S(name, **kw):
            base = dict(fontName="LS", fontSize=8.5, leading=12.5, textColor=INK)
            base.update(kw)
            return ParagraphStyle(name, **base)

        body = S("body")
        muted = S("muted", textColor=GREY)
        val_r = S("val_r", alignment=TA_RIGHT, fontName="LSB")
        val_r_n = S("val_r_n", alignment=TA_RIGHT)
        cap = S("cap", fontName="LSB", fontSize=7.5, leading=10, textColor=RUST)
        th_l = S("th_l", fontName="LSB", fontSize=8, textColor=colors.white)
        th_c = S("th_c", fontName="LSB", fontSize=8, textColor=colors.white, alignment=TA_CENTER)
        th_r = S("th_r", fontName="LSB", fontSize=8, textColor=colors.white, alignment=TA_RIGHT)
        cell_c = S("cell_c", alignment=TA_CENTER)
        cell_r = S("cell_r", alignment=TA_RIGHT)
        cell_rb = S("cell_rb", alignment=TA_RIGHT, fontName="LSB")
        bullet = S("bullet", textColor=GREY, fontSize=8, leading=12, leftIndent=9, firstLineIndent=-9, spaceAfter=3)

        brand = "AUREL HOME"
        tagline = "ATELIER CURATIONS & BESPOKE LIVING"
        doc_title = "CONSIGNMENT INVOICE"
        company_name = data.get("business", {}).get("legal_name", BUSINESS_LEGAL_NAME)
        company_lines = [
            "Atelier 4, Industrial Design Estate, Worli,",
            "Mumbai, Maharashtra - 400018, India",
            "concierge@aurelhome.com  |  +91 (022) 8921-2873",
            f"GSTIN: <b>{data.get('business', {}).get('gstin', BUSINESS_GSTIN)}</b> <font size=\"7.5\">(Demo / Pending Verification)</font>",
        ]

        meta = [
            ("Invoice Number", data["invoice_number"]),
            ("Order Reference", data["order_number"]),
            ("Invoice Date", data.get("invoice_date", "—")),
            ("Delivery Date", data.get("delivery_date", "—")),
            ("Consignment Status", '<font color="#0F9D6B">DELIVERED</font>'),
        ]

        rec = data.get("recipient", {})
        customer_name = rec.get("full_name") or "Valued Patron"

        # Build address lines matching the reference template
        addr_parts = []
        street = rec.get("address", "")
        apt = rec.get("apartment", "")
        if street and apt:
            addr_parts.append(f"{street}, {apt}")
        elif street:
            addr_parts.append(street)
        elif apt:
            addr_parts.append(apt)

        city = rec.get("city", "")
        state = rec.get("state", "")
        pin = rec.get("postal_code", "")
        city_state = ", ".join(filter(None, [city, state]))
        if city_state and pin:
            addr_parts.append(f"{city_state} - {pin}")
        elif city_state:
            addr_parts.append(city_state)
        elif pin:
            addr_parts.append(pin)

        if not addr_parts:
            addr_parts = ["Address details on record"]

        # Payment details
        is_paid = (data.get("payment_status") or "").lower() == "paid"
        paid_online = data.get("paid_online", False)
        pm = (data.get("payment_method") or "").lower()
        orig_pm = (data.get("original_payment_method") or "").lower()

        if is_paid:
            if paid_online:
                status_html = '<font color="#0F9D6B"><b>PAID (ONLINE)</b></font>'
            elif pm == "cod" or orig_pm == "cod":
                status_html = '<font color="#0F9D6B"><b>PAID (CASH ON DELIVERY)</b></font>'
            else:
                status_html = '<font color="#0F9D6B"><b>PAID (ONLINE)</b></font>'
        else:
            status_html = '<font color="#C4573A"><b>PAYMENT PENDING</b></font>'

        method_str = data.get("payment_display") or "UPI (Razorpay)"
        ref_str = data.get("payment_reference") or ("pay_authorized" if is_paid else "Pending Settlement")
        verified_date = data.get("paid_at") or data.get("delivery_date") or data.get("invoice_date") or "—"

        payment = [
            ("Status", status_html),
            ("Method", method_str),
            ("Reference", f"<b>{ref_str}</b>"),
            ("Verified on", verified_date),
        ]

        footer_left = "Aurel Home Atelier Private Limited  \u2022  concierge@aurelhome.com"

        def draw_first(c, d):
            c.saveState()
            y = H - 24 * mm
            t = c.beginText(M, y)
            t.setFont("LSB", 22)
            t.setFillColor(INK)
            t.setCharSpace(7)
            t.textOut(brand)
            t.setCharSpace(0)
            c.drawText(t)

            t = c.beginText(M, y - 6.5 * mm)
            t.setFont("LSB", 7.5)
            t.setFillColor(RUST)
            t.setCharSpace(0.8)
            t.textOut(tagline)
            t.setCharSpace(0)
            c.drawText(t)

            c.setFillColor(INK)
            c.setFont("LSB", 16)
            c.drawRightString(W - M, y + 0.5 * mm, doc_title)
            footer(c, d)
            c.restoreState()

        def draw_later(c, d):
            c.saveState()
            t = c.beginText(M, H - 16 * mm)
            t.setFont("LSB", 11)
            t.setFillColor(INK)
            t.setCharSpace(4)
            t.textOut(brand)
            t.setCharSpace(0)
            c.drawText(t)

            c.setFont("LS", 8.5)
            c.setFillColor(GREY)
            c.drawRightString(W - M, H - 16 * mm, f"Invoice {data.get('invoice_number', '')}")
            footer(c, d)
            c.restoreState()

        def footer(c, d):
            c.setStrokeColor(LINE)
            c.setLineWidth(0.6)
            c.line(M, 17 * mm, W - M, 17 * mm)
            c.setFillColor(GREY)
            c.setFont("LS", 7.5)
            c.drawString(M, 12 * mm, footer_left)
            c.drawRightString(W - M, 12 * mm, f"Page {d.page}")

        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            title=f"Invoice-{data.get('invoice_number', '')}",
            author=company_name,
        )
        doc.addPageTemplates([
            PageTemplate(id="first", frames=[Frame(M, 22 * mm, CW, H - 22 * mm - 42 * mm, 0, 0, 0, 0)], onPage=draw_first),
            PageTemplate(id="later", frames=[Frame(M, 22 * mm, CW, H - 22 * mm - 28 * mm, 0, 0, 0, 0)], onPage=draw_later),
        ])
        story = [NextPageTemplate("later")]

        # Company block + invoice metadata
        left = [Paragraph(f"<b>{company_name}</b>", S("cn", fontSize=10, leading=14)), Spacer(1, 3)]
        left += [Paragraph(l, muted) for l in company_lines]
        meta_w = 74 * mm
        mt = Table([[Paragraph(k, muted), Paragraph(v, val_r)] for k, v in meta], colWidths=[36 * mm, meta_w - 36 * mm])
        mt.hAlign = 'RIGHT'
        mt.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 3.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ]))
        head = Table([[left, mt]], colWidths=[CW - meta_w, meta_w])
        head.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 4 * mm),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story += [head, Spacer(1, 9 * mm), HRFlowable(width="100%", thickness=0.6, color=LINE), Spacer(1, 8 * mm)]

        # Billed-to / payment cards
        gap = 8 * mm
        card_w = (CW - gap) / 2
        pad = 12
        inner = card_w - 2 * pad
        billed = [
            Paragraph("BILLED & DELIVERED TO", cap),
            Spacer(1, 6),
            Paragraph(f"<b>{customer_name}</b>", S("cust", fontSize=11, leading=15)),
            Spacer(1, 2),
        ]
        billed += [Paragraph(l, muted) for l in addr_parts]
        billed += [
            Spacer(1, 6),
            kv_table([("Phone", rec.get("phone") or "—"), ("Email", rec.get("email") or "—")], [15 * mm, inner - 15 * mm], muted, body),
        ]
        paid = [
            Paragraph("PAYMENT & SETTLEMENT", cap),
            Spacer(1, 6),
            kv_table(payment, [24 * mm, inner - 24 * mm], muted, body),
        ]
        cards = Table([[billed, "", paid]], colWidths=[card_w, gap, card_w])
        cards.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (0, 0), CARD),
            ("BACKGROUND", (2, 0), (2, 0), CARD),
            ("BOX", (0, 0), (0, 0), 0.5, LINE),
            ("BOX", (2, 0), (2, 0), 0.5, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), pad),
            ("RIGHTPADDING", (0, 0), (-1, -1), pad),
            ("LEFTPADDING", (1, 0), (1, 0), 0),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 13),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
        ]))
        story += [cards, Spacer(1, 10 * mm)]

        # Items Table
        rows = [[
            Paragraph("#", th_c),
            Paragraph("Consignment Artifact Description", th_l),
            Paragraph("Qty", th_c),
            Paragraph("Unit Price", th_r),
            Paragraph("Line Total", th_r),
        ]]
        subtotal = 0.0
        for i, item in enumerate(data.get("items", []), start=1):
            name = item.get("product_name", "Curated Artifact")
            qty = item.get("quantity", 1)
            uprice = float(item.get("unit_price", 0.0))
            line = float(item.get("line_total", qty * uprice))
            subtotal += line
            desc = [Paragraph(f"<b>{name}</b>", body)]
            rows.append([
                Paragraph(str(i), cell_c),
                desc,
                Paragraph(str(qty), cell_c),
                Paragraph(R(uprice), cell_r),
                Paragraph(R(line, True), cell_rb),
            ])

        cw = [14 * mm, CW - 14 * mm - 18 * mm - 34 * mm - 36 * mm, 18 * mm, 34 * mm, 36 * mm]
        it = Table(rows, colWidths=cw, repeatRows=1)
        it.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("TOPPADDING", (0, 1), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 11),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
        ]))
        story += [it, Spacer(1, 9 * mm)]

        # Notes + Totals
        tot_w = 80 * mm
        shipping = float(data.get("shipping_amount", 0.0))
        discount = float(data.get("discount", 0.0))
        total = float(data.get("total_amount", subtotal + shipping - discount))
        ship_txt = "Complimentary" if shipping == 0 else R(shipping)

        tt_rows = [
            [Paragraph("Subtotal", muted), Paragraph(R(subtotal), val_r_n)],
            [Paragraph("Shipping & Handling", muted), Paragraph(ship_txt, val_r_n)],
        ]
        if discount > 0:
            tt_rows.append([Paragraph("Privilege Discount", muted), Paragraph(f"-{R(discount)}", val_r_n)])

        total_label = "<b>Total Settled</b>" if is_paid else "<b>Total Amount Payable</b>"
        tt_rows.append([
            Paragraph(total_label, S("tl", fontSize=10.5, leading=14)),
            Paragraph(f'<font color="#C4573A" size="13"><b>{R(total, True)}</b></font>', S("tv", alignment=TA_RIGHT, leading=17)),
        ])

        tt = Table(tt_rows, colWidths=[tot_w - 38 * mm, 38 * mm])
        tt.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -2), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -2), 7),
            ("TOPPADDING", (0, -1), (-1, -1), 10),
            ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ("LINEABOVE", (0, -1), (-1, -1), 1.2, INK),
            ("BACKGROUND", (0, -1), (-1, -1), CARD),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ]))

        note_w = CW - tot_w - 10 * mm
        notes = [
            "All items are genuine bespoke creations curated by Aurel Home Atelier.",
            "Prices are inclusive of applicable goods & services taxes and white-glove transit.",
            "This is a certified computer-generated invoice requiring no physical signature.",
            "Concierge support: concierge@aurelhome.com \u2022 Mon\u2013Sat 10:00\u201318:00 IST",
        ]
        note_blk = [Paragraph("CONSIGNMENT & TAX INFORMATION", cap), Spacer(1, 5)] + [Paragraph(f"\u2022  {n}", bullet) for n in notes]
        bottom = Table([[note_blk, "", tt]], colWidths=[note_w, 10 * mm, tot_w])
        bottom.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(KeepTogether([bottom]))

        doc.build(story)
        return buffer.getvalue()
