
import requests

def test_upload():
    url = "http://localhost:8000/api/analysis/photo"
    # Note: We need a token. We'll try to register/login first.
    
    # 1. Register/Login
    reg_url = "http://localhost:8000/api/auth/register"
    user_data = {
        "email": "test@example.com",
        "password": "password",
        "name": "Test",
        "region": "Global",
        "lifestyle_type": "General",
        "sustainability_goals": []
    }
    res = requests.post(reg_url, json=user_data)
    if res.status_code == 400: # Already exists?
        res = requests.post("http://localhost:8000/api/auth/login", json={"email": "test@example.com", "password": "password"})
    
    token = res.json().get('token')
    print(f"Token: {token[:10]}...")
    
    # 2. Upload with manual content-type (incorrect)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "multipart/form-data" 
    }
    files = {'file': ('test.jpg', b'dummy content', 'image/jpeg')}
    print("Testing with manual Content-Type...")
    # requests handles multipart differently, but we want to see how the server responds to manual header
    # In requests, if we provide 'files', it sets the header. If we also provide 'headers', it might overwrite.
    res = requests.post(url, headers=headers, files=files)
    print(f"Status Code (Manual CT): {res.status_code}")
    print(f"Response: {res.text}")

    # 3. Upload without manual content-type (correct)
    headers = {
        "Authorization": f"Bearer {token}"
    }
    print("Testing without manual Content-Type...")
    res = requests.post(url, headers=headers, files=files)
    print(f"Status Code (Auto CT): {res.status_code}")
    print(f"Response: {res.text}")

if __name__ == "__main__":
    test_upload()
