import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.environ.get('GOOGLE_API_KEY')

print(f"Key present: {api_key is not None}")

genai.configure(api_key=api_key)

try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content('Hello')
    print("Response:", response.text)
except Exception as e:
    print("Error Type:", type(e).__name__)
    print("Error Args:", e.args)
    print("Error Str:", str(e))
