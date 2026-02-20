
import asyncio
import openai
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

api_key = os.environ.get('EMERGENT_LLM_KEY')

async def test_endpoint(base_url):
    print(f"\n--- Testing base_url: {base_url} ---")
    # In newer openai, you should create a client. But let's see if patching module works.
    # Actually, let's use the Client class to be safe and modern.
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    try:
        print(f"Attempting completion with {base_url}...")
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say hello"}]
        )
        print("SUCCESS!")
        print(response.choices[0].message.content)
        return True
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        return False

async def main():
    endpoints = [
        None, # Default (api.openai.com)
        "https://api.emergent.ai/v1",
        "https://api.emergentagent.com/v1"
    ]
    for ep in endpoints:
        if await test_endpoint(ep):
            print(f"\nFound working endpoint: {ep}")
            break

if __name__ == "__main__":
    asyncio.run(main())
