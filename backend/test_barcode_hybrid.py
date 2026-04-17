import asyncio
import os
import google.generativeai as genai
import httpx
import json
import re
from typing import Optional
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')
genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))

# Mocking the server logic for standalone testing
async def lookup_upcitemdb(barcode: str) -> Optional[dict]:
    url = "https://api.upcitemdb.com/prod/trial/lookup"
    params = {'upc': barcode}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'OK' and data.get('items'):
                    item = data['items'][0]
                    return {
                        "product_name": item.get('title'),
                        "brand": item.get('brand'),
                        "category": item.get('category'),
                        "details": item.get('description', '')
                    }
    except Exception as e:
        print(f"DB Error: {e}")
    return None

async def test_resolve(barcode):
    print(f"\n--- Testing Barcode: {barcode} ---")
    db_info = await lookup_upcitemdb(barcode)
    
    if db_info:
        print(f"Found in DB: {db_info['product_name']}")
        prompt = f"""Map this product to one of [electronics, clothing, food, home, vehicle, beauty, sports, books, other]:
        Name: {db_info['product_name']}
        Category: {db_info['category']}
        
        Return ONLY JSON with 'category' field.
        """
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(model.generate_content, prompt)
        print(f"Mapped Category: {response.text.strip()}")
    else:
        print("Not in DB. Falling back to AI...")
        prompt = f"Identify this barcode: {barcode}. Return JSON with product_name and category."
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(model.generate_content, prompt)
        print(f"AI Result: {response.text.strip()}")

if __name__ == "__main__":
    barcodes = ["044000004971", "195949016301", "4902430574421"]
    for b in barcodes:
        asyncio.run(test_resolve(b))
