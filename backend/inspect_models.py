import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get('GOOGLE_API_KEY')
genai.configure(api_key=api_key)

print(f"Testing with API Key: {api_key[:10]}...")

try:
    print("\n--- Available Models ---")
    models = genai.list_models()
    for m in models:
        # Print full name and supported methods
        print(f"Name: {m.name}")
        print(f"Methods: {m.supported_generation_methods}")
        print("-" * 20)
except Exception as e:
    print(f"Error listing models: {e}")
