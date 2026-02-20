import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get('GOOGLE_API_KEY')
genai.configure(api_key=api_key)

try:
    print("SEARCH_START")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"FOUND:{m.name}")
    print("SEARCH_END")
except Exception as e:
    print(f"ERROR:{e}")
