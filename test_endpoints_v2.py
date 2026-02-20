
import asyncio
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

api_key = os.environ.get('EMERGENT_LLM_KEY')

async def test_endpoint(base_url):
    print(f"\n--- Testing base_url: {base_url} ---")
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=10
        )
        print("SUCCESS!")
        print(response.choices[0].message.content)
        return True
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        return False

async def main():
    if not api_key:
        print("Error: EMERGENT_LLM_KEY not found in .env")
        return

    endpoints = [
        "https://api.openai.com/v1",
        "https://api.emergent.social/v1",
        "https://api.emergentagent.com/v1",
        "https://api.emergent.ai/v1"
    ]
    for ep in endpoints:
        if await test_endpoint(ep):
            print(f"\nWORKING ENDPOINT FOUND: {ep}")
            # return ep # Don't stop, see if others work
    
if __name__ == "__main__":
    asyncio.run(main())
