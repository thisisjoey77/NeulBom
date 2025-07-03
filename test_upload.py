#!/usr/bin/env python3
"""
Test script to verify image upload to the backend server.
This script creates a test image and uploads it to the /process_frame endpoint.
"""

import requests
import cv2
import numpy as np
import io

# Create a test image
test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)

# Encode the image as JPEG
success, buffer = cv2.imencode('.jpg', test_image)
if not success:
    print("Failed to encode test image")
    exit(1)

# Create a file-like object from the buffer
image_bytes = io.BytesIO(buffer.tobytes())

# Upload to server
server_url = "http://54.180.16.112:5000/process_frame"
files = {'frame': ('test.jpg', image_bytes, 'image/jpeg')}

try:
    response = requests.post(server_url, files=files, timeout=30)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        print("✅ Upload successful!")
    else:
        print("❌ Upload failed!")
        
except requests.exceptions.RequestException as e:
    print(f"❌ Request failed: {e}")
