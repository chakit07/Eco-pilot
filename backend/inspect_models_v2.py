import os
import sys
import google.generativeai as genai
from dotenv import load_dotenv

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()
api_key = os.environ.get('GOOGLE_API_KEY')
genai.configure(api_key=api_key)

print(f"Testing with API Key: {api_key[:10]}...")

try:
    print("\n--- Available Models ---")
    models = genai.list_models()
    for m in models:
        # Check if it supports generateContent
        if 'generateContent' in m.supported_generation_methods:
            print(f"ModelName: {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
