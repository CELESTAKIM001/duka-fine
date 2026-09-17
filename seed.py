import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from api.index import hash_password

load_dotenv()

client = MongoClient(os.getenv("MONGODB_URI"))
db = client[os.getenv("MONGODB_DB", "dukafine")]

now = datetime.now(timezone.utc)
email = "seller@dukafine.example"
user = db.users.find_one({"email": email})

if not user:
    result = db.users.insert_one({
        "name": "Demo Seller",
        "email": email,
        "phone_number": "254700000000",
        "password_hash": hash_password("ChangeMe123!"),
        "role": "seller",
        "is_verified": True,
        "created_at": now
    })
    user_id = result.inserted_id
else:
    user_id = user["_id"]

store = db.stores.find_one({"owner_id": user_id})
if not store:
    result = db.stores.insert_one({
        "vendor_name": "DukaFine Demo Store",
        "slug": "dukafine-demo",
        "till_number": "123456",
        "phone_number": "254700000000",
        "email": email,
        "owner_id": user_id,
        "created_at": now
    })
    store_id = result.inserted_id
else:
    store_id = store["_id"]

if db.products.count_documents({"store_id": store_id}) == 0:
    db.products.insert_many([
        {
            "store_id": store_id,
            "name": "Premium Shopping Bag",
            "description": "Reusable everyday shopping bag.",
            "price": 450,
            "quantity": 50,
            "image_url": "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80",
            "created_at": now
        },
        {
            "store_id": store_id,
            "name": "Classic Sneakers",
            "description": "Everyday casual sneakers.",
            "price": 3200,
            "quantity": 20,
            "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
            "created_at": now
        },
        {
            "store_id": store_id,
            "name": "Wireless Headphones",
            "description": "Compact Bluetooth headphones.",
            "price": 2800,
            "quantity": 15,
            "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
            "created_at": now
        }
    ])

print("Seed complete.")
print("Demo seller: seller@dukafine.example / ChangeMe123!")
