#!/usr/bin/env python3
import requests
import cv2
import numpy as np

# Create a simple test image with a person-like shape
test_image = np.zeros((480, 640, 3), dtype=np.uint8)
# Draw a more realistic person shape
cv2.ellipse(test_image, (320, 100), (40, 50), 0, 0, 360, (255, 255, 255), -1)  # head
cv2.rectangle(test_image, (280, 150), (360, 350), (255, 255, 255), -1)  # body
cv2.rectangle(test_image, (230, 180), (280, 220), (255, 255, 255), -1)  # left arm
cv2.rectangle(test_image, (360, 180), (410, 220), (255, 255, 255), -1)  # right arm
cv2.rectangle(test_image, (295, 350), (325, 450), (255, 255, 255), -1)  # left leg
cv2.rectangle(test_image, (335, 350), (365, 450), (255, 255, 255), -1)  # right leg

# Encode as JPEG
_, buffer = cv2.imencode('.jpg', test_image)

# Save the test image for inspection
cv2.imwrite('test_person.jpg', test_image)
print("Test image saved as test_person.jpg")

# Test the deployed backend
url = 'http://54.180.16.112:5000/process_frame'
files = {'frame': ('test_person.jpg', buffer.tobytes(), 'image/jpeg')}

try:
    response = requests.post(url, files=files)
    print(f"Response status: {response.status_code}")
    print(f"Response content: {response.text}")
except Exception as e:
    print(f"Error: {e}")
