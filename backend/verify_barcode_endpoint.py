import requests
import json
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

BASE_URL = "http://localhost:8000/api"
# Check if server is running on a different port or needs auth
# For testing purpose, we'll try to login first if needed, 
# but let's assume we can test the resolution function internally or if we have a token.

def test_barcode_endpoint(barcode, token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/analysis/barcode/{barcode}", headers=headers)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Response data:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    # We need a valid token to test the endpoint
    # You might need to run the server first and login to get a token
    print("This script assumes the backend is running at http://localhost:8000")
    print("Please provide a valid JWT token to test the authenticated endpoint.")
    # In a real scenario, I'd mock the check or run a login flow here.
    # For now, I'll just check if the logic in server.py is sound by running a local test of the function.
