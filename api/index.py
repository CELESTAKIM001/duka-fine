import os
import base64
import hashlib
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from functools import wraps

import jwt
import requests
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import DuplicateKeyError

load_dotenv()

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_URL", "*")}}, supports_credentials=True)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("dukafine")

SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_ME")
JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", "30"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").lower().strip()
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", os.getenv("FRONTEND_URL", "http://localhost:5173")).rstrip("/")

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))

mongo_uri = os.getenv("MONGODB_URI")
mongo_db_name = os.getenv("MONGODB_DB", "dukafine")
client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000) if mongo_uri else None
db = client[mongo_db_name] if client else None

if db is not None:
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.stores.create_index([("slug", ASCENDING)], unique=True)
    db.products.create_index([("store_id", ASCENDING)])
    db.orders.create_index([("order_number", ASCENDING)], unique=True)
    db.orders.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.payments.create_index([("checkout_request_id", ASCENDING)], unique=True, sparse=True)
    db.audit_logs.create_index([("created_at", DESCENDING)])


def now():
    return datetime.now(timezone.utc)


def oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


def jsonable(doc):
    if not doc:
        return doc
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


def clean_phone(phone):
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif digits.startswith("7") and len(digits) == 9:
        digits = "254" + digits
    return digits


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 150_000)
    return base64.b64encode(salt + digest).decode()


def verify_password(password, stored):
    try:
        raw = base64.b64decode(stored)
        salt, digest = raw[:16], raw[16:]
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 150_000)
        return secrets.compare_digest(check, digest)
    except Exception:
        return False


def generate_otp():
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_otp(otp):
    return hashlib.sha256(otp.encode()).hexdigest()


def create_token(user):
    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user.get("role", "customer"),
        "exp": now() + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(header[7:], SECRET_KEY, algorithms=["HS256"])
        return db.users.find_one({"_id": oid(payload["sub"])}) if db is not None else None
    except Exception:
        return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return fn(user, *args, **kwargs)
    return wrapper


def require_admin(fn):
    @wraps(fn)
    def wrapper(user, *args, **kwargs):
        if user.get("role") != "admin":
            return jsonify({"error": "Administrator access required"}), 403
        return fn(user, *args, **kwargs)
    return require_auth(wrapper)


def audit(action, actor=None, metadata=None):
    if db is None:
        return
    db.audit_logs.insert_one({
        "action": action,
        "actor_id": str(actor["_id"]) if actor else None,
        "actor_email": actor.get("email") if actor else None,
        "metadata": metadata or {},
        "created_at": now(),
    })


def send_email(to, subject, html, text):
    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", username or "DUKAFINE <no-reply@example.com>")
    if not host or not username or not password:
        logger.warning("SMTP is not configured; email skipped for %s", to)
        return False

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(msg)
    return True


def email_receipt(order, user, store, items):
    rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{i['name']} × {i['quantity']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>KSh {i['line_total']:,.2f}</td></tr>"
        for i in items
    )
    address = order.get("delivery_address", "Not supplied")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#222">
      <div style="background:#0d6b45;color:#fff;padding:24px;border-radius:14px 14px 0 0">
        <h1 style="margin:0">DUKAFINE</h1><p style="margin:6px 0 0">Payment receipt & order confirmation</p>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px">
        <h2>Order {order['order_number']}</h2>
        <p>Thank you, {user['name']}. Your payment has been received.</p>
        <table width="100%" cellspacing="0">{rows}</table>
        <h3 style="text-align:right">Total: KSh {order['amount']:,.2f}</h3>
        <p><b>M-Pesa Transaction:</b> {order.get('mpesa_code') or 'Pending'}</p>
        <p><b>Delivery address:</b> {address}</p>
        <hr>
        <p style="font-size:12px;color:#666">This is an automated DUKAFINE receipt.</p>
      </div>
    </div>
    """
    text = (
        f"DUKAFINE Order {order['order_number']}\n"
        f"Customer: {user['name']}\n"
        f"Amount: KSh {order['amount']:,.2f}\n"
        f"M-Pesa: {order.get('mpesa_code') or 'Pending'}\n"
        f"Delivery: {address}\n"
    )
    return send_email(user["email"], f"DUKAFINE receipt — {order['order_number']}", html, text)


def email_seller(order, user, store, items):
    rows = "".join(
        f"<li>{i['name']} × {i['quantity']} — KSh {i['line_total']:,.2f}</li>"
        for i in items
    )
    seller_email = store.get("email")
    if not seller_email:
        return False
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#222">
      <div style="background:#111827;color:white;padding:22px;border-radius:14px 14px 0 0">
        <h1 style="margin:0">New DukaFine Order</h1>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:0">
        <h2>{order['order_number']}</h2>
        <p>A customer has completed payment.</p>
        <ul>{rows}</ul>
        <p><b>Total:</b> KSh {order['amount']:,.2f}</p>
        <p><b>Customer:</b> {user['name']} — {user['phone_number']}</p>
        <p><b>Delivery:</b> {order.get('delivery_address', 'Not supplied')}</p>
        <p><b>M-Pesa:</b> {order.get('mpesa_code', 'Pending')}</p>
      </div>
    </div>
    """
    text = (
        f"New DUKAFINE order {order['order_number']}\n"
        f"Customer: {user['name']} / {user['phone_number']}\n"
        f"Amount: KSh {order['amount']:,.2f}\n"
        f"Delivery: {order.get('delivery_address', 'Not supplied')}\n"
        f"M-Pesa: {order.get('mpesa_code', 'Pending')}\n"
    )
    return send_email(seller_email, f"New DUKAFINE order — {order['order_number']}", html, text)


def send_otp_email(user, otp):
    code_boxes = "".join(
        f"<td style='padding:0 4px'><div style='width:42px;height:52px;border-radius:10px;background:#f0faf5;"
        f"border:1px solid #cfe9db;color:#0d6b45;font-size:24px;font-weight:800;font-family:monospace;"
        f"display:flex;align-items:center;justify-content:center'>{digit}</div></td>"
        for digit in otp
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#222">
      <div style="background:#0d6b45;color:#fff;padding:24px;border-radius:14px 14px 0 0;text-align:center">
        <h1 style="margin:0;letter-spacing:.05em">DUKAFINE</h1>
        <p style="margin:6px 0 0">Verify your email address</p>
      </div>
      <div style="padding:28px 24px;border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px;text-align:center">
        <p>Hi {user['name']}, use the code below to verify your account.</p>
        <table style="margin:20px auto" cellspacing="0"><tr>{code_boxes}</tr></table>
        <p style="font-size:22px;font-weight:800;letter-spacing:.3em;color:#0d6b45;margin:18px 0 6px">{otp}</p>
        <p style="font-size:13px;color:#666">This code expires in {OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee">
        <p style="font-size:12px;color:#999">If you did not request this, you can safely ignore this email.</p>
      </div>
    </div>
    """
    text = (
        f"DUKAFINE verification code: {otp}\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n"
        f"If you did not request this, ignore this email.\n"
    )
    sent = send_email(user["email"], "Your DUKAFINE verification code", html, text)
    if not sent:
        # SMTP not configured (e.g. local dev) — surface the code in server logs only.
        logger.info("SMTP not configured. OTP for %s is %s", user["email"], otp)
    return sent


def mpesa_base():
    env = os.getenv("MPESA_ENV", "sandbox").lower()
    return "https://sandbox.safaricom.co.ke" if env == "sandbox" else "https://api.safaricom.co.ke"


def mpesa_token():
    key = os.getenv("MPESA_CONSUMER_KEY")
    secret = os.getenv("MPESA_CONSUMER_SECRET")
    if not key or not secret:
        raise RuntimeError("Daraja consumer credentials are not configured")
    auth = base64.b64encode(f"{key}:{secret}".encode()).decode()
    response = requests.get(
        f"{mpesa_base()}/oauth/v1/generate?grant_type=client_credentials",
        headers={"Authorization": f"Basic {auth}"},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def mpesa_password(timestamp):
    shortcode = os.getenv("MPESA_BUSINESS_SHORT_CODE", "")
    passkey = os.getenv("MPESA_PASSKEY", "")
    raw = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


def initiate_stk(order, customer_phone, vendor_till):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    shortcode = os.getenv("MPESA_BUSINESS_SHORT_CODE")
    callback = os.getenv("MPESA_CALLBACK_URL")
    transaction_type = os.getenv("MPESA_TRANSACTION_TYPE", "CustomerBuyGoodsOnline")

    if not shortcode or not callback or not os.getenv("MPESA_PASSKEY"):
        raise RuntimeError("Daraja shortcode, passkey or callback URL is not configured")

    # IMPORTANT: for Buy Goods, PartyB is the vendor's Till.
    payload = {
        "BusinessShortCode": shortcode,
        "Password": mpesa_password(timestamp),
        "Timestamp": timestamp,
        "TransactionType": transaction_type,
        "Amount": int(round(order["amount"])),
        "PartyA": customer_phone,
        "PartyB": vendor_till,
        "PhoneNumber": customer_phone,
        "CallBackURL": callback,
        "AccountReference": order["order_number"],
        "TransactionDesc": f"DUKAFINE {order['order_number']}",
    }

    token = mpesa_token()
    response = requests.post(
        f"{mpesa_base()}/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    if data.get("ResponseCode") != "0":
        raise RuntimeError(data.get("errorMessage") or data.get("ResponseDescription") or "STK Push rejected")

    return data


@app.get("/api/health")
def health():
    try:
        if db is not None:
            db.command("ping")
        return jsonify({"ok": True, "service": "dukafine"})
    except Exception as exc:
        logger.exception("Health check failed")
        return jsonify({"ok": False, "error": str(exc)}), 503


@app.post("/api/auth/register")
def register():
    data = request.get_json(force=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    phone = clean_phone(data.get("phone_number"))
    password = str(data.get("password", ""))

    if not all([name, email, phone, password]) or len(password) < 8:
        return jsonify({"error": "Name, email, phone and an 8+ character password are required"}), 400
    if db is None:
        return jsonify({"error": "Database is not configured"}), 503

    existing = db.users.find_one({"email": email})
    if existing:
        if existing.get("is_verified"):
            return jsonify({"error": "Email is already registered"}), 409
        # Account exists but was never verified — issue a fresh code instead of blocking.
        otp = generate_otp()
        db.users.update_one({"_id": existing["_id"]}, {"$set": {
            "otp_hash": hash_otp(otp),
            "otp_expires_at": now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
            "otp_attempts": 0,
            "otp_last_sent_at": now(),
        }})
        send_otp_email(existing, otp)
        audit("user.otp_resent_on_register", existing)
        return jsonify({
            "message": "This email is already registered but not verified. A new verification code has been sent.",
            "email": email,
            "requires_verification": True,
        }), 200

    role = "admin" if ADMIN_EMAIL and email == ADMIN_EMAIL else "customer"
    otp = generate_otp()
    user = {
        "name": name,
        "email": email,
        "phone_number": phone,
        "password_hash": hash_password(password),
        "role": role,
        "is_verified": False,
        "otp_hash": hash_otp(otp),
        "otp_expires_at": now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        "otp_attempts": 0,
        "otp_last_sent_at": now(),
        "created_at": now(),
    }
    try:
        result = db.users.insert_one(user)
    except DuplicateKeyError:
        return jsonify({"error": "Email is already registered"}), 409

    user["_id"] = result.inserted_id
    send_otp_email(user, otp)
    audit("user.registered", user)
    return jsonify({
        "message": "Account created. Enter the verification code sent to your email.",
        "email": email,
        "requires_verification": True,
    }), 201


@app.post("/api/auth/verify-otp")
def verify_otp():
    data = request.get_json(force=True) or {}
    email = str(data.get("email", "")).strip().lower()
    otp = str(data.get("otp", "")).strip()
    if not email or not otp:
        return jsonify({"error": "Email and verification code are required"}), 400
    if db is None:
        return jsonify({"error": "Database is not configured"}), 503

    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "Account not found"}), 404
    if user.get("is_verified"):
        public_user = {k: v for k, v in user.items() if k != "password_hash"}
        return jsonify({"message": "Email already verified", "token": create_token(user), "user": jsonable(public_user)})

    if not user.get("otp_hash") or not user.get("otp_expires_at"):
        return jsonify({"error": "No verification code is pending. Request a new one."}), 400
    if now() > user["otp_expires_at"]:
        return jsonify({"error": "Verification code has expired. Request a new one."}), 400
    if user.get("otp_attempts", 0) >= OTP_MAX_ATTEMPTS:
        return jsonify({"error": "Too many incorrect attempts. Request a new code."}), 429
    if not secrets.compare_digest(hash_otp(otp), user["otp_hash"]):
        db.users.update_one({"_id": user["_id"]}, {"$inc": {"otp_attempts": 1}})
        remaining = OTP_MAX_ATTEMPTS - user.get("otp_attempts", 0) - 1
        return jsonify({"error": "Incorrect verification code", "attempts_remaining": max(remaining, 0)}), 400

    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"is_verified": True, "verified_at": now()},
            "$unset": {"otp_hash": "", "otp_expires_at": "", "otp_attempts": "", "otp_last_sent_at": ""},
        },
    )
    user = db.users.find_one({"_id": user["_id"]})
    audit("user.email_verified", user)
    public_user = {k: v for k, v in user.items() if k != "password_hash"}
    return jsonify({"token": create_token(user), "user": jsonable(public_user)})


@app.post("/api/auth/resend-otp")
def resend_otp():
    data = request.get_json(force=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if db is None:
        return jsonify({"error": "Database is not configured"}), 503

    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "Account not found"}), 404
    if user.get("is_verified"):
        return jsonify({"error": "Email is already verified"}), 400

    last_sent = user.get("otp_last_sent_at")
    if last_sent:
        elapsed = (now() - last_sent).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
            retry_after = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            return jsonify({"error": f"Please wait {retry_after}s before requesting another code", "retry_after": retry_after}), 429

    otp = generate_otp()
    db.users.update_one({"_id": user["_id"]}, {"$set": {
        "otp_hash": hash_otp(otp),
        "otp_expires_at": now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        "otp_attempts": 0,
        "otp_last_sent_at": now(),
    }})
    send_otp_email(user, otp)
    audit("user.otp_resent", user)
    return jsonify({"message": "Verification code resent"})


@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = db.users.find_one({"email": email}) if db is not None else None

    if not user or not verify_password(password, user.get("password_hash", "")):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.get("is_verified"):
        return jsonify({
            "error": "Please verify your email before signing in",
            "code": "email_not_verified",
            "email": email,
        }), 403

    audit("user.login", user)
    public_user = {k: v for k, v in user.items() if k != "password_hash"}
    return jsonify({"token": create_token(user), "user": jsonable(public_user)})


@app.get("/api/auth/me")
@require_auth
def me(user):
    return jsonify({"user": jsonable({k: v for k, v in user.items() if k != "password_hash"})})


@app.get("/api/stores")
def stores():
    docs = list(db.stores.find({}).sort("created_at", DESCENDING)) if db is not None else []
    return jsonify({"stores": [jsonable(d) for d in docs]})


@app.get("/api/products")
def products():
    query = {}
    store_id = request.args.get("store_id")
    if store_id and oid(store_id):
        query["store_id"] = oid(store_id)
    search = request.args.get("search", "").strip()
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    docs = list(db.products.find(query).sort("created_at", DESCENDING).limit(100)) if db is not None else []
    return jsonify({"products": [jsonable(d) for d in docs]})


@app.get("/api/products/<product_id>")
def product_detail(product_id):
    p = db.products.find_one({"_id": oid(product_id)}) if db is not None else None
    if not p:
        return jsonify({"error": "Product not found"}), 404
    store = db.stores.find_one({"_id": p["store_id"]})
    data = jsonable(p)
    data["store"] = jsonable(store)
    return jsonify({"product": data})


@app.post("/api/stores")
@require_auth
def create_store(user):
    data = request.get_json(force=True) or {}
    if user.get("role") not in ("admin", "seller"):
        return jsonify({"error": "Seller account required"}), 403
    name = str(data.get("name", "")).strip()
    till = clean_phone(data.get("till_number")) if str(data.get("till_number", "")).startswith("254") else str(data.get("till_number", "")).strip()
    phone = clean_phone(data.get("phone_number"))
    email = str(data.get("email", user.get("email"))).strip().lower()
    slug = "-".join(name.lower().split()) + "-" + secrets.token_hex(3)
    if not name or not till or not phone:
        return jsonify({"error": "Store name, Buy Goods Till and phone are required"}), 400
    store = {
        "vendor_name": name,
        "slug": slug,
        "till_number": till,
        "phone_number": phone,
        "email": email,
        "owner_id": user["_id"],
        "created_at": now(),
    }
    result = db.stores.insert_one(store)
    store["_id"] = result.inserted_id
    audit("store.created", user, {"store_id": str(result.inserted_id)})
    return jsonify({"store": jsonable(store)}), 201


@app.post("/api/products")
@require_auth
def create_product(user):
    data = request.get_json(force=True) or {}
    store_id = oid(data.get("store_id"))
    store = db.stores.find_one({"_id": store_id}) if store_id else None
    if not store or (store.get("owner_id") != user["_id"] and user.get("role") != "admin"):
        return jsonify({"error": "You do not control this store"}), 403

    product = {
        "store_id": store_id,
        "name": str(data.get("name", "")).strip(),
        "description": str(data.get("description", "")).strip(),
        "price": float(data.get("price", 0)),
        "quantity": int(data.get("quantity", 0)),
        "image_url": str(data.get("image_url", "")).strip(),
        "created_at": now(),
    }
    if not product["name"] or product["price"] <= 0 or product["quantity"] < 0:
        return jsonify({"error": "Valid product name, price and stock are required"}), 400

    result = db.products.insert_one(product)
    product["_id"] = result.inserted_id
    audit("product.created", user, {"product_id": str(result.inserted_id)})
    return jsonify({"product": jsonable(product)}), 201


@app.post("/api/checkout/verify")
@require_auth
def checkout_verify(user):
    data = request.get_json(force=True) or {}
    cart = data.get("items", [])
    address = str(data.get("delivery_address", "")).strip()
    if not cart:
        return jsonify({"error": "Cart is empty"}), 400

    verified = []
    total = 0.0

    for item in cart:
        product_id = oid(item.get("product_id"))
        quantity = int(item.get("quantity", 0))
        if not product_id or quantity < 1:
            return jsonify({"error": "Invalid cart item"}), 400

        product = db.products.find_one({"_id": product_id})
        if not product:
            return jsonify({"error": f"Product {item.get('product_id')} no longer exists"}), 409
        if product.get("quantity", 0) < quantity:
            return jsonify({
                "error": f"Insufficient stock for {product['name']}",
                "available": product.get("quantity", 0),
            }), 409

        line = round(float(product["price"]) * quantity, 2)
        total += line
        verified.append({
            "product_id": product["_id"],
            "store_id": product["store_id"],
            "name": product["name"],
            "price": float(product["price"]),
            "quantity": quantity,
            "line_total": line,
            "image_url": product.get("image_url", ""),
        })

    stores_used = {str(x["store_id"]) for x in verified}
    if len(stores_used) != 1:
        return jsonify({"error": "Each payment must contain products from one vendor store"}), 400

    return jsonify({
        "verified": True,
        "amount": round(total, 2),
        "store_id": next(iter(stores_used)),
        "items": [jsonable(x) for x in verified],
        "delivery_address": address,
    })


@app.post("/api/checkout")
@require_auth
def checkout(user):
    data = request.get_json(force=True) or {}
    cart = data.get("items", [])
    address = str(data.get("delivery_address", "")).strip()
    phone = clean_phone(data.get("phone_number") or user.get("phone_number"))

    if not cart:
        return jsonify({"error": "Cart is empty"}), 400
    if not address:
        return jsonify({"error": "Delivery address is required"}), 400
    if not phone.startswith("254") or len(phone) != 12:
        return jsonify({"error": "Use a valid Kenyan Safaricom number"}), 400

    # Re-run inventory verification immediately before payment.
    verified = []
    total = 0.0
    store_id = None

    for item in cart:
        product = db.products.find_one({"_id": oid(item.get("product_id"))})
        qty = int(item.get("quantity", 0))
        if not product:
            return jsonify({"error": "A cart product no longer exists"}), 409
        if qty < 1 or product["quantity"] < qty:
            return jsonify({"error": f"Insufficient stock for {product['name']}"}), 409
        if store_id is None:
            store_id = product["store_id"]
        elif store_id != product["store_id"]:
            return jsonify({"error": "One checkout cannot combine multiple stores"}), 400
        line = round(float(product["price"]) * qty, 2)
        total += line
        verified.append({
            "product_id": product["_id"],
            "name": product["name"],
            "price": float(product["price"]),
            "quantity": qty,
            "line_total": line,
            "image_url": product.get("image_url", ""),
        })

    store = db.stores.find_one({"_id": store_id})
    if not store:
        return jsonify({"error": "Vendor store not found"}), 409

    order_number = f"DF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    order = {
        "store_id": store_id,
        "user_id": user["_id"],
        "order_number": order_number,
        "amount": round(total, 2),
        "mpesa_code": None,
        "receipt": None,
        "status": "payment_pending",
        "payment_phone": phone,
        "delivery_address": address,
        "items": verified,
        "created_at": now(),
        "updated_at": now(),
    }
    result = db.orders.insert_one(order)
    order["_id"] = result.inserted_id

    try:
        mpesa = initiate_stk(order, phone, store["till_number"])
    except Exception as exc:
        logger.exception("M-Pesa initiation failed")
        db.orders.update_one({"_id": result.inserted_id}, {"$set": {"status": "payment_initialization_failed", "payment_error": str(exc), "updated_at": now()}})
        audit("payment.initialization_failed", user, {"order_id": str(result.inserted_id)})
        return jsonify({"error": "Payment initialization failed. Check Daraja configuration.", "detail": str(exc)}), 502

    db.payments.insert_one({
        "order_id": result.inserted_id,
        "merchant_request_id": mpesa.get("MerchantRequestID"),
        "checkout_request_id": mpesa.get("CheckoutRequestID"),
        "status": "pending",
        "created_at": now(),
    })
    audit("payment.stk_initialized", user, {"order_id": str(result.inserted_id)})

    return jsonify({
        "message": mpesa.get("CustomerMessage", "STK Push sent"),
        "order": jsonable(order),
        "checkout_request_id": mpesa.get("CheckoutRequestID"),
    }), 201


@app.get("/api/orders/<order_id>")
@require_auth
def order_status(user, order_id):
    order = db.orders.find_one({"_id": oid(order_id), "user_id": user["_id"]})
    if not order:
        return jsonify({"error": "Order not found"}), 404
    return jsonify({"order": jsonable(order)})


@app.post("/api/mpesa/callback")
def mpesa_callback():
    body = request.get_json(silent=True) or {}
    callback = body.get("Body", {}).get("stkCallback", {})
    checkout_id = callback.get("CheckoutRequestID")
    result_code = callback.get("ResultCode")

    payment = db.payments.find_one({"checkout_request_id": checkout_id}) if checkout_id else None
    if not payment:
        audit("mpesa.callback_unmatched", None, {"checkout_request_id": checkout_id})
        return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"})

    order = db.orders.find_one({"_id": payment["order_id"]})
    if not order:
        return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"})

    if result_code == 0:
        metadata = {
            x.get("Name"): x.get("Value")
            for x in callback.get("CallbackMetadata", {}).get("Item", [])
            if x.get("Name")
        }
        mpesa_code = metadata.get("MpesaReceiptNumber")
        amount = metadata.get("Amount", order["amount"])
        phone = metadata.get("PhoneNumber")

        # Atomic stock decrement: prevents overselling when concurrent callbacks/orders occur.
        stock_ok = True
        for item in order["items"]:
            result = db.products.update_one(
                {"_id": item["product_id"], "quantity": {"$gte": item["quantity"]}},
                {"$inc": {"quantity": -item["quantity"]}},
            )
            if result.modified_count != 1:
                stock_ok = False
                break

        if not stock_ok:
            db.orders.update_one({"_id": order["_id"]}, {"$set": {
                "status": "payment_received_stock_conflict",
                "mpesa_code": mpesa_code,
                "updated_at": now(),
            }})
            audit("order.stock_conflict_after_payment", None, {"order_id": str(order["_id"]), "mpesa_code": mpesa_code})
        else:
            db.orders.update_one({"_id": order["_id"]}, {"$set": {
                "status": "paid",
                "mpesa_code": mpesa_code,
                "receipt": mpesa_code,
                "paid_amount": amount,
                "paid_phone": phone,
                "updated_at": now(),
            }})
            order = db.orders.find_one({"_id": order["_id"]})
            user = db.users.find_one({"_id": order["user_id"]})
            store = db.stores.find_one({"_id": order["store_id"]})

            try:
                email_receipt(order, user, store, order["items"])
                email_seller(order, user, store, order["items"])
            except Exception:
                logger.exception("Order email notification failed")

            audit("order.paid", user, {"order_id": str(order["_id"]), "mpesa_code": mpesa_code})

        db.payments.update_one({"_id": payment["_id"]}, {"$set": {
            "status": "success",
            "result_code": result_code,
            "result_description": callback.get("ResultDesc"),
            "mpesa_code": mpesa_code,
            "updated_at": now(),
        }})
    else:
        db.orders.update_one({"_id": order["_id"]}, {"$set": {
            "status": "payment_failed",
            "payment_result": callback.get("ResultDesc"),
            "updated_at": now(),
        }})
        db.payments.update_one({"_id": payment["_id"]}, {"$set": {
            "status": "failed",
            "result_code": result_code,
            "result_description": callback.get("ResultDesc"),
            "updated_at": now(),
        }})
        audit("payment.failed", None, {"order_id": str(order["_id"]), "result_code": result_code})

    return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"})


@app.get("/api/admin/stats")
@require_admin
def admin_stats(user):
    return jsonify({
        "users": db.users.count_documents({}),
        "stores": db.stores.count_documents({}),
        "products": db.products.count_documents({}),
        "orders": db.orders.count_documents({}),
        "paid_orders": db.orders.count_documents({"status": "paid"}),
        "pending_orders": db.orders.count_documents({"status": "payment_pending"}),
        "revenue": sum((x.get("amount", 0) for x in db.orders.find({"status": "paid"}, {"amount": 1})), 0),
    })


@app.get("/api/admin/orders")
@require_admin
def admin_orders(user):
    docs = list(db.orders.find({}).sort("created_at", DESCENDING).limit(200))
    return jsonify({"orders": [jsonable(x) for x in docs]})


@app.get("/api/admin/logs")
@require_admin
def admin_logs(user):
    docs = list(db.audit_logs.find({}).sort("created_at", DESCENDING).limit(300))
    return jsonify({"logs": [jsonable(x) for x in docs]})


@app.get("/api/admin/stores")
@require_admin
def admin_stores(user):
    docs = list(db.stores.find({}).sort("created_at", DESCENDING).limit(200))
    return jsonify({"stores": [jsonable(x) for x in docs]})


@app.get("/api/share/product/<product_id>")
@require_auth
def share_product(user, product_id):
    product = db.products.find_one({"_id": oid(product_id)})
    if not product:
        return jsonify({"error": "Product not found"}), 404
    store = db.stores.find_one({"_id": product["store_id"]})
    if not store:
        return jsonify({"error": "Store not found"}), 404

    url = f"{PUBLIC_APP_URL}/product/{product_id}"
    text = (
        f"*{store['vendor_name']}*\n"
        f"*{product['name']}*\n"
        f"Price: KSh {product['price']:,.2f}\n"
        f"Shop: {url}\n"
        f"Image: {product.get('image_url', '')}"
    )
    whatsapp_url = "https://wa.me/?text=" + requests.utils.quote(text)
    return jsonify({"text": text, "whatsapp_url": whatsapp_url, "storefront_url": url})


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(Exception)
def unhandled(exc):
    logger.exception("Unhandled exception")
    return jsonify({"error": "Internal server error"}), 500
