
import asyncio
import openai
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

openai.api_key = os.environ.get('EMERGENT_LLM_KEY')

async def test():
    print(f"Using API Key: {openai.api_key[:5]}..." if openai.api_key else "No API Key")
    try:
        print("Attempting await openai.chat.completions.create...")
        response = await openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say hello"}]
        )
        print("Response received!")
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Caught error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test())
