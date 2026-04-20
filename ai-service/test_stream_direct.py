import httpx
import json

URL = "http://localhost:8500/ai-chat/stream"
payload = {"message": "hi", "user_id": "test", "user_role": "USER", "auth_token": "test"}

try:
    with httpx.stream("POST", URL, json=payload, timeout=30.0) as r:
        print(f"Status: {r.status_code}")
        for line in r.iter_lines():
            print(f"LINE: |{line}|")
except Exception as e:
    print(f"Error: {e}")
