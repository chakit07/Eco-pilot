import asyncio
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')
api_key = os.environ.get('GOOGLE_API_KEY')
genai.configure(api_key=api_key)

async def test_barcode(barcode):
    prompt = f"""Identify the product for barcode: {barcode}.
    Return ONLY JSON with:
    - product_name
    - category (one of: electronics, clothing, food, home, vehicle, beauty, sports, books, other)
    - brand
    - details
    """
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = await asyncio.to_thread(model.generate_content, prompt)
    print(f"Barcode: {barcode}")
    print(f"Result: {response.text}")

if __name__ == "__main__":
    # Test with a few barcodes
    barcodes = [
        "195949016301", # iPhone 15
        "0684344400512", # Apple (generic)
        "4902430574421", # Febreze / P&G
        "044000004971"    # Oreo
    ]
    for b in barcodes:
        asyncio.run(test_barcode(b))
