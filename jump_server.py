# ...existing code...

# Endpoint to receive and process frames from browser (must be after app is defined)
import io
from werkzeug.utils import secure_filename
from flask import Flask, send_file, Response, jsonify, request
import subprocess
import threading
import cv2
import os
import numpy as np
import time
import random
from ultralytics import YOLO
from flask_cors import CORS
import openai
from dotenv import load_dotenv

# ...existing code...
#%pip install flask

# Load environment variables
load_dotenv()

# After you create your Flask app:
app = Flask(__name__)
CORS(app)

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# Global jump count for BR31
br31_jump_count = 0
br31_last_reset = time.time()
br31_jump_times_global = []
br31_person_history = {}
br31_person_states = {}
br31_last_jump_time = None
br31_can_jump = True
SYNC_WINDOW = 0.25
JUMP_THRESHOLD = 50
JUMP_END_TIMEOUT = 2.5


@app.route('/')
def index():
    return send_file('temp.html')

@app.route('/process_frame', methods=['POST', 'GET'])
def process_frame():
    global br31_jump_count, br31_jump_times_global, br31_person_history, br31_person_states, br31_last_jump_time, br31_can_jump
    if request.method == 'GET':
        return jsonify({'message': 'Use POST to upload frames for processing'}), 200

    # Check if frame is in files or in form data
    if 'frame' not in request.files:
        return jsonify({'error': 'No frame uploaded'}), 400

    file = request.files['frame']

    # Check if file is empty
    if file.filename == '':
        return jsonify({'error': 'Empty file uploaded'}), 400

    try:
        # Read file content
        file_content = file.read()
        print(f'Received file size: {len(file_content)} bytes')

        if len(file_content) == 0:
            return jsonify({'error': 'Empty file content'}), 400

        # Check if it's a valid image by looking at the first few bytes
        if len(file_content) < 10:
            return jsonify({'error': 'File too small to be a valid image'}), 400

        # Check for JPEG header
        if not (file_content[:2] == b'\xff\xd8' or file_content[:3] == b'\x89PNG' or file_content[:4] == b'data'):
            print(f'Invalid file header: {file_content[:10]}')
            return jsonify({'error': 'Invalid image format - not a JPEG or PNG'}), 400

        # Convert to numpy array
        file_bytes = np.frombuffer(file_content, np.uint8)
        print(f'Numpy array size: {len(file_bytes)}')

        if len(file_bytes) == 0:
            return jsonify({'error': 'Empty numpy array'}), 400

        # Decode image
        frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({'error': 'Failed to decode image - invalid format or corrupted data'}), 400

        print(f'Successfully decoded frame with shape: {frame.shape}')

    except Exception as e:
        print(f'Error processing uploaded file: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'File processing error: {str(e)}'}), 400

    # Run YOLO pose detection and jump detection for browser frames
    try:
        # Lower threshold for browser testing
        JUMP_THRESHOLD = 20
        print('Loading YOLO model...')
        model = YOLO('yolov8n-pose.pt')
        print('Running YOLO inference...')
        results = model(frame)
        print('Processing results...')
        keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
        num_people = len(keypoints)
        print(f'Detected {num_people} people')
        print(f'Keypoints: {keypoints}')
        current_time = time.time()
        jump_times = []
        ids_in_frame = []
        for i, kp in enumerate(keypoints):
            if kp.shape[0] == 0:
                continue
            nose = kp[0]
            print(f'Person {i} nose_y: {nose[1]}')
            nose_x, nose_y = nose[0], nose[1]
            person_id = i
            ids_in_frame.append(person_id)
            prev_y = br31_person_history.get(person_id, nose_y)
            state = br31_person_states.get(person_id, 'ground')
            print(f'Person {person_id} prev_y: {prev_y}, nose_y: {nose_y}, state: {state}')
            if state == 'ground' and prev_y - nose_y > JUMP_THRESHOLD:
                print(f'JUMP DETECTED for person {person_id}!')
                jump_times.append((person_id, current_time))
                br31_person_states[person_id] = 'air'
                br31_jump_times_global.append(current_time)
            elif state == 'air':
                if abs(nose_y - prev_y) < JUMP_THRESHOLD // 3:
                    br31_person_states[person_id] = 'ground'
            br31_person_history[person_id] = nose_y
        for pid in list(br31_person_history.keys()):
            if pid not in ids_in_frame:
                del br31_person_history[pid]
                if pid in br31_person_states:
                    del br31_person_states[pid]
        # Synchronized jump detection (like jump game)
        all_on_ground = all(br31_person_states.get(pid, 'ground') == 'ground' for pid in ids_in_frame)
        if len(br31_jump_times_global) >= len(keypoints) and br31_can_jump and all_on_ground and len(keypoints) > 0:
            window = max(br31_jump_times_global[-len(keypoints):]) - min(br31_jump_times_global[-len(keypoints):])
            print(f'Jump window: {window}, SYNC_WINDOW: {SYNC_WINDOW}')
            if window <= SYNC_WINDOW:
                br31_jump_count += 1
                br31_last_jump_time = current_time
                br31_can_jump = False
                print(f'JUMP COUNT INCREMENTED! New count: {br31_jump_count}')
        if not br31_can_jump and all_on_ground:
            br31_can_jump = True
            br31_jump_times_global = []
        if br31_jump_count > 0 and br31_last_jump_time and (current_time - br31_last_jump_time > JUMP_END_TIMEOUT):
            br31_jump_times_global = []
        # Return both people and jump count for debugging
        return jsonify({'people': num_people, 'jumps': br31_jump_count})
    except Exception as e:
        print(f'YOLO processing error: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'YOLO processing error: {str(e)}'}), 500

@app.route('/video_feed')
def video_feed():
    def gen():
        model = YOLO('yolov8n-pose.pt')
        JUMP_THRESHOLD = 50
        SYNC_WINDOW = 0.25
        person_history = {}
        person_states = {}
        jump_target = random.randint(1, 10)
        round_state = 'show_number'
        state_start_time = time.time()
        jump_count = 0
        jump_times_global = []
        jump_detected = False
        result_message = ''
        result_color = (0, 255, 0)
        result_shown_at = 0
        result_display_time = 2.0
        JUMP_END_TIMEOUT = 2.5
        last_jump_time = None
        can_jump = True
        cap = cv2.VideoCapture(0)
        
        # Check if camera is accessible
        if not cap.isOpened():
            print("Warning: Cannot access camera on server")
            # Return a simple error frame
            error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(error_frame, 'Camera not available on server', (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            _, jpeg = cv2.imencode('.jpg', error_frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
            return
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    print("Warning: Failed to read from camera")
                    break
                results = model(frame)
                boxes = results[0].boxes.xyxy.cpu().numpy() if results[0].boxes is not None else []
                keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
                current_time = time.time()
                jump_times = []
                ids_in_frame = []
                for i, kp in enumerate(keypoints):
                    if kp.shape[0] == 0:
                        continue
                    nose = kp[0]
                    nose_x, nose_y = nose[0], nose[1]
                    person_id = i
                    ids_in_frame.append(person_id)
                    prev_y = person_history.get(person_id, nose_y)
                    state = person_states.get(person_id, 'ground')
                    if state == 'ground' and prev_y - nose_y > JUMP_THRESHOLD:
                        jump_times.append((person_id, current_time))
                        person_states[person_id] = 'air'
                        jump_times_global.append(current_time)
                    elif state == 'air':
                        if abs(nose_y - prev_y) < JUMP_THRESHOLD // 3:
                            person_states[person_id] = 'ground'
                    person_history[person_id] = nose_y
                    for x, y in kp:
                        cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                    if i < len(boxes):
                        x1, y1, x2, y2 = boxes[i]
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                for pid in list(person_history.keys()):
                    if pid not in ids_in_frame:
                        del person_history[pid]
                        if pid in person_states:
                            del person_states[pid]
                # State machine for the game
                if round_state == 'show_number':
                    cv2.putText(frame, f'Target: {jump_target}', (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 255), 6)
                    if current_time - state_start_time > 1.5:
                        round_state = 'countdown'
                        state_start_time = current_time
                elif round_state == 'countdown':
                    seconds_left = 3 - int(current_time - state_start_time)
                    if seconds_left > 0:
                        cv2.putText(frame, str(seconds_left), (250, 250), cv2.FONT_HERSHEY_SIMPLEX, 5, (42, 42, 165), 15)
                        cv2.putText(frame, f'Target: {jump_target}', (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 255), 6)
                    else:
                        round_state = 'jumping'
                        state_start_time = current_time
                        jump_count = 0
                        jump_times_global = []
                        jump_detected = False
                        last_jump_time = None
                        can_jump = True
                elif round_state == 'jumping':
                    all_on_ground = all(person_states.get(pid, 'ground') == 'ground' for pid in ids_in_frame)
                    if len(jump_times_global) >= len(keypoints) and not jump_detected and can_jump and all_on_ground:
                        window = max(jump_times_global[-len(keypoints):]) - min(jump_times_global[-len(keypoints):])
                        if window <= SYNC_WINDOW:
                            jump_count += 1
                            jump_detected = True
                            last_jump_time = current_time
                            can_jump = False
                        else:
                            round_state = 'result'
                            result_message = 'Fail (Not synchronous)'
                            result_color = (0, 0, 255)
                            result_shown_at = current_time
                    if jump_detected and all(person_states.get(pid, 'ground') == 'ground' for pid in ids_in_frame):
                        jump_detected = False
                        jump_times_global = []
                        can_jump = True
                    if jump_count > 0 and last_jump_time and (current_time - last_jump_time > JUMP_END_TIMEOUT):
                        if jump_count == jump_target:
                            round_state = 'result'
                            result_message = 'Success!'
                            result_color = (0, 255, 0)
                        else:
                            round_state = 'result'
                            result_message = 'Fail (Wrong count)'
                            result_color = (0, 0, 255)
                        result_shown_at = current_time
                    cv2.putText(frame, f'Jumps: {jump_count}', (100, 180), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 0, 255), 6)
                    cv2.putText(frame, f'Target: {jump_target}', (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 255), 6)
                elif round_state == 'result':
                    cv2.putText(frame, result_message, (100, 250), cv2.FONT_HERSHEY_SIMPLEX, 2.5, result_color, 8)
                    if current_time - result_shown_at > result_display_time:
                        jump_target = random.randint(1, 10)
                        round_state = 'show_number'
                        state_start_time = current_time
                        jump_count = 0
                        jump_times_global = []
                        jump_detected = False
                        last_jump_time = None
                        can_jump = True
                        for pid in list(person_states.keys()):
                            person_states[pid] = 'ground'
                        for pid in list(person_history.keys()):
                            person_history[pid] = 0
                _, jpeg = cv2.imencode('.jpg', frame)
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        finally:
            cap.release()
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/video-feed-369')
def video_feed_369():
    def gen():
        model = YOLO('yolov8n-pose.pt')
        cap = cv2.VideoCapture(0)
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                results = model(frame)
                boxes = results[0].boxes.xyxy.cpu().numpy() if results[0].boxes is not None else []
                keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
                num_people = len(keypoints)
                cv2.putText(frame, f'People: {num_people}', (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 6)
                for i, kp in enumerate(keypoints):
                    for x, y in kp:
                        cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                    if i < len(boxes):
                        x1, y1, x2, y2 = boxes[i]
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                _, jpeg = cv2.imencode('.jpg', frame)
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        finally:
            cap.release()
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/video-feed-lastWord')
def video_feed_lastWord():
    def gen():
        model = YOLO('yolov8n-pose.pt')
        cap = cv2.VideoCapture(0)
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                results = model(frame)
                boxes = results[0].boxes.xyxy.cpu().numpy() if results[0].boxes is not None else []
                keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
                num_people = len(keypoints)
                cv2.putText(frame, f'People: {num_people}', (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 6)
                for i, kp in enumerate(keypoints):
                    for x, y in kp:
                        cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                    if i < len(boxes):
                        x1, y1, x2, y2 = boxes[i]
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                _, jpeg = cv2.imencode('.jpg', frame)
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        finally:
            cap.release()
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/video-feed-br')
def video_feed_br():
    def gen():
        global br31_jump_count, br31_jump_times_global, br31_person_history, br31_person_states, br31_last_jump_time, br31_can_jump
        try:
            model = YOLO('yolov8n-pose.pt')
            cap = cv2.VideoCapture(0)
            try:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        print('[ERROR] Camera read failed')
                        break
                    try:
                        results = model(frame)
                        boxes = results[0].boxes.xyxy.cpu().numpy() if results[0].boxes is not None else []
                        keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
                        num_people = len(keypoints)
                        current_time = time.time()
                        jump_times = []
                        ids_in_frame = []
                        for i, kp in enumerate(keypoints):
                            if kp.shape[0] == 0:
                                continue
                            nose = kp[0]
                            nose_x, nose_y = nose[0], nose[1]
                            person_id = i
                            ids_in_frame.append(person_id)
                            prev_y = br31_person_history.get(person_id, nose_y)
                            state = br31_person_states.get(person_id, 'ground')
                            if state == 'ground' and prev_y - nose_y > JUMP_THRESHOLD:
                                jump_times.append((person_id, current_time))
                                br31_person_states[person_id] = 'air'
                                br31_jump_times_global.append(current_time)
                            elif state == 'air':
                                if abs(nose_y - prev_y) < JUMP_THRESHOLD // 3:
                                    br31_person_states[person_id] = 'ground'
                            br31_person_history[person_id] = nose_y
                            for x, y in kp:
                                cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                            if i < len(boxes):
                                x1, y1, x2, y2 = boxes[i]
                                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                        for pid in list(br31_person_history.keys()):
                            if pid not in ids_in_frame:
                                del br31_person_history[pid]
                                if pid in br31_person_states:
                                    del br31_person_states[pid]
                        # Synchronized jump detection (like jump game)
                        all_on_ground = all(br31_person_states.get(pid, 'ground') == 'ground' for pid in ids_in_frame)
                        if len(br31_jump_times_global) >= len(keypoints) and br31_can_jump and all_on_ground and len(keypoints) > 0:
                            window = max(br31_jump_times_global[-len(keypoints):]) - min(br31_jump_times_global[-len(keypoints):])
                            if window <= SYNC_WINDOW:
                                br31_jump_count += 1
                                br31_last_jump_time = current_time
                                br31_can_jump = False
                        if not br31_can_jump and all_on_ground:
                            br31_can_jump = True
                            br31_jump_times_global = []
                        if br31_jump_count > 0 and br31_last_jump_time and (current_time - br31_last_jump_time > JUMP_END_TIMEOUT):
                            br31_jump_times_global = []
                        cv2.putText(frame, f'People: {num_people}', (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 6)
                        cv2.putText(frame, f'Jumps: {br31_jump_count}', (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 0, 255), 6)
                        _, jpeg = cv2.imencode('.jpg', frame)
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                    except Exception as e:
                        print('[ERROR] Exception in frame processing:', e)
                        # Return a red error frame
                        error_frame = np.zeros((360, 480, 3), dtype=np.uint8)
                        cv2.putText(error_frame, 'ERROR', (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 3, (0,0,255), 8)
                        _, jpeg = cv2.imencode('.jpg', error_frame)
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                        break
            finally:
                cap.release()
        except Exception as e:
            print('[ERROR] Exception in /video-feed-br:', e)
            # Return a red error frame
            error_frame = np.zeros((360, 480, 3), dtype=np.uint8)
            cv2.putText(error_frame, 'SERVER ERROR', (10, 200), cv2.FONT_HERSHEY_SIMPLEX, 2, (0,0,255), 6)
            _, jpeg = cv2.imencode('.jpg', error_frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/people_count', methods=['POST'])
def people_count():
    # Accepts an uploaded image frame from the browser and returns the number of people detected
    if 'frame' not in request.files:
        return jsonify({'error': 'No frame uploaded'}), 400
    file = request.files['frame']
    if file.filename == '':
        return jsonify({'error': 'Empty file uploaded'}), 400
    try:
        file_content = file.read()
        if len(file_content) == 0:
            return jsonify({'error': 'Empty file content'}), 400
        if len(file_content) < 10:
            return jsonify({'error': 'File too small to be a valid image'}), 400
        if not (file_content[:2] == b'\xff\xd8' or file_content[:3] == b'\x89PNG' or file_content[:4] == b'data'):
            return jsonify({'error': 'Invalid image format - not a JPEG or PNG'}), 400
        file_bytes = np.frombuffer(file_content, np.uint8)
        if len(file_bytes) == 0:
            return jsonify({'error': 'Empty numpy array'}), 400
        frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({'error': 'Failed to decode image - invalid format or corrupted data'}), 400
    except Exception as e:
        return jsonify({'error': f'File processing error: {str(e)}'}), 400
    try:
        model = YOLO('yolov8n-pose.pt')
        results = model(frame)
        keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
        num_people = len(keypoints)
        return jsonify({'people': num_people})
    except Exception as e:
        return jsonify({'error': f'YOLO processing error: {str(e)}'}), 500


@app.route('/jump_count')
def jump_count():
    global br31_jump_count
    return jsonify({'count': br31_jump_count})


@app.route('/reset_jump_count', methods=['POST'])
def reset_jump_count():
    global br31_jump_count, br31_last_reset, br31_jump_times_global, br31_person_history, br31_person_states, br31_last_jump_time, br31_can_jump
    br31_jump_count = 0
    br31_last_reset = time.time()
    br31_jump_times_global = []
    br31_person_history = {}
    br31_person_states = {}
    br31_last_jump_time = None
    br31_can_jump = True
    return jsonify({'status': 'reset'})

# OpenAI API endpoint
@app.route('/api/openai', methods=['POST'])
def openai_chat():
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        model = data.get('model', 'gpt-3.5-turbo')
        
        if not messages:
            return jsonify({'error': 'Messages are required'}), 400
        
        # Create OpenAI client instance
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # Call OpenAI API using new client interface
        response = client.chat.completions.create(
            model=model,
            messages=messages
        )
        
        # Convert response to dict format
        response_dict = {
            "choices": [
                {
                    "message": {
                        "content": response.choices[0].message.content,
                        "role": response.choices[0].message.role
                    }
                }
            ]
        }
        
        return jsonify(response_dict)
    except Exception as e:
        print(f'OpenAI API Error: {e}')
        return jsonify({'error': 'Failed to call OpenAI API'}), 500

@app.route('/test_yolo')
def test_yolo():
    try:
        # Create a simple test image with a person-like shape
        test_image = np.zeros((480, 640, 3), dtype=np.uint8)
        # Draw a simple stick figure (head, body, arms, legs)
        cv2.circle(test_image, (320, 100), 30, (255, 255, 255), -1)  # head
        cv2.rectangle(test_image, (300, 130), (340, 250), (255, 255, 255), -1)  # body
        cv2.rectangle(test_image, (260, 150), (300, 170), (255, 255, 255), -1)  # left arm
        cv2.rectangle(test_image, (340, 150), (380, 170), (255, 255, 255), -1)  # right arm
        cv2.rectangle(test_image, (300, 250), (320, 350), (255, 255, 255), -1)  # left leg
        cv2.rectangle(test_image, (320, 250), (340, 350), (255, 255, 255), -1)  # right leg
        
        print('Testing YOLO with synthetic image...')
        model = YOLO('yolov8n-pose.pt')
        results = model(test_image)
        
        print('YOLO model loaded successfully')
        print(f'Results: {results}')
        
        if results and len(results) > 0:
            result = results[0]
            print(f'Result type: {type(result)}')
            print(f'Result attributes: {dir(result)}')
            
            # Check if keypoints exist
            if hasattr(result, 'keypoints') and result.keypoints is not None:
                keypoints = result.keypoints.xy.cpu().numpy()
                print(f'Keypoints shape: {keypoints.shape}')
                print(f'Keypoints: {keypoints}')
                num_people = len(keypoints)
            else:
                print('No keypoints found')
                num_people = 0
                
            # Check if boxes exist
            if hasattr(result, 'boxes') and result.boxes is not None:
                boxes = result.boxes.xyxy.cpu().numpy()
                print(f'Boxes shape: {boxes.shape}')
                print(f'Boxes: {boxes}')
            else:
                print('No boxes found')
        else:
            print('No results from YOLO')
            num_people = 0
        
        return jsonify({
            'test_result': 'success',
            'people_detected': num_people,
            'message': 'YOLO model test completed'
        })
    except Exception as e:
        print(f'YOLO test error: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'YOLO test failed: {str(e)}'}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))  # Use PORT from environment if available
    
    # Check if we should use HTTPS
    use_https = os.environ.get('USE_HTTPS', 'false').lower() == 'true'
    
    if use_https:
        # For HTTPS, we need SSL context
        # You can generate self-signed certificates or use proper SSL certificates
        ssl_context = 'adhoc'  # This creates a temporary self-signed certificate
        app.run(host='0.0.0.0', port=port, debug=False, ssl_context=ssl_context)
    else:
        app.run(host='0.0.0.0', port=port, debug=False)  # debug=False for production