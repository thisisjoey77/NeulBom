import signal
import sys
import logging
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
from PIL import Image, ImageSequence

# Configure logging to avoid stdout/stderr issues
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Set up logger with error handling
logger = logging.getLogger(__name__)

# Custom handler to prevent EPIPE errors
class SafeStreamHandler(logging.StreamHandler):
    def emit(self, record):
        try:
            super().emit(record)
        except (BrokenPipeError, OSError) as e:
            # Silently ignore broken pipe errors during shutdown
            if e.errno != 32:  # EPIPE
                raise

# Replace the default handler with our safe one
logger.handlers.clear()
safe_handler = SafeStreamHandler(sys.stdout)
safe_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(safe_handler)
logger.setLevel(logging.INFO)

# Signal handler for graceful shutdown
def signal_handler(signum, frame):
    logger.info(f"Received signal {signum}, shutting down...")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# After you create your Flask app:
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

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

# Global variables for koala GIF animation
koala_frames = []
koala_frame_index = 0
last_frame_time = 0
FRAME_DELAY = 0.08  # 80ms between frames for smoother animation
koala_position_x = 0
koala_position_y = 0
koala_animation_offset = 0  # For bouncing effect
koala_flip_state = False  # False = normal, True = flipped (for left movement)
person_previous_x = None  # Track person's previous position for movement detection

# Load the koala GIF frames once when the server starts
def load_koala_frames():
    global koala_frames
    try:
        gif_path = 'KakaoTalk_Photo_2025-07-17-13-41-48.gif'
        gif = Image.open(gif_path)
        for frame in ImageSequence.Iterator(gif):
            # Convert to RGBA and resize to a much bigger size (400x400 pixels)
            frame = frame.convert('RGBA')
            frame = frame.resize((400, 400), Image.Resampling.LANCZOS)
            # Convert to numpy array
            frame_array = np.array(frame)
            koala_frames.append(frame_array)
        logger.info(f"Loaded {len(koala_frames)} koala GIF frames at 400x400 size")
    except Exception as e:
        logger.error(f"Failed to load koala GIF: {e}")
        koala_frames = []

# Call this when the server starts
load_koala_frames()


@app.route('/')
def index():
    return send_file('index.html')


@app.route('/video-feed-main')
def video_feed_main():
    def gen():
        global koala_frame_index, last_frame_time
        model = YOLO('yolov8n-pose.pt')
        cap = cv2.VideoCapture(0)
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                # Get YOLO detections
                results = model(frame)
                boxes = results[0].boxes.xyxy.cpu().numpy() if results[0].boxes is not None else []
                keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
                
                # Find the person most in front (largest bounding box)
                largest_area = 0
                front_person = None
                front_box = None
                
                for i, box in enumerate(boxes):
                    if i < len(keypoints):
                        x1, y1, x2, y2 = box
                        area = (x2 - x1) * (y2 - y1)
                        if area > largest_area:
                            largest_area = area
                            front_person = keypoints[i]
                            front_box = box
                
                # Draw keypoints for all detected people
                for i, kp in enumerate(keypoints):
                    for x, y in kp:
                        cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 0), -1)
                    if i < len(boxes):
                        x1, y1, x2, y2 = boxes[i]
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
                
                # If we found a person, animate the koala
                if front_person is not None and len(koala_frames) > 0:
                    global koala_position_x, koala_position_y, koala_animation_offset, koala_flip_state, person_previous_x
                    
                    current_time = time.time()
                    
                    # Update animation frame
                    if current_time - last_frame_time >= FRAME_DELAY:
                        koala_frame_index = (koala_frame_index + 1) % len(koala_frames)
                        last_frame_time = current_time
                    
                    # Track person's movement for koala flipping
                    # Use the center of the bounding box as reference
                    x1, y1, x2, y2 = front_box
                    person_current_x = (x1 + x2) / 2
                    
                    # Determine movement direction and flip koala accordingly
                    if person_previous_x is not None:
                        movement_threshold = 20  # Minimum movement to trigger flip
                        if person_current_x - person_previous_x > movement_threshold:
                            # Person moved right, koala faces right (normal orientation)
                            koala_flip_state = False
                        elif person_previous_x - person_current_x > movement_threshold:
                            # Person moved left, koala faces left (flipped orientation)
                            koala_flip_state = True
                    
                    # Update previous position for next frame
                    person_previous_x = person_current_x
                    
                    # Create bouncing animation effect
                    koala_animation_offset = int(10 * np.sin(current_time * 3))  # Bouncing effect
                    
                    # Get koala frame
                    koala = koala_frames[koala_frame_index].copy()
                    
                    # YOLO pose keypoints: 0=nose, 1=left_eye, 2=right_eye, 3=left_ear, 4=right_ear
                    # Extract key facial features
                    nose = front_person[0] if len(front_person) > 0 else None
                    left_eye = front_person[1] if len(front_person) > 1 else None
                    right_eye = front_person[2] if len(front_person) > 2 else None
                    left_ear = front_person[3] if len(front_person) > 3 else None
                    right_ear = front_person[4] if len(front_person) > 4 else None
                    
                    # Position koala on the right side of the person (consistently)
                    if right_ear is not None and right_ear[0] > 0 and right_ear[1] > 0:
                        # Position near right ear
                        koala_position_x = int(right_ear[0] + 60)  # Offset to the right
                        koala_position_y = int(right_ear[1] - 80 + koala_animation_offset)  # Above ear with bounce
                    elif right_eye is not None and right_eye[0] > 0 and right_eye[1] > 0:
                        # Position near right eye
                        koala_position_x = int(right_eye[0] + 100)  # Offset to the right
                        koala_position_y = int(right_eye[1] - 60 + koala_animation_offset)  # Above eye with bounce
                    else:
                        # Fallback to right side of face
                        x1, y1, x2, y2 = front_box
                        koala_position_x = int(x2 + 50)  # Right side of bounding box
                        koala_position_y = int(y1 + (y2 - y1) * 0.2 + koala_animation_offset)  # Upper area with bounce
                    
                    # Flip koala based on person's movement direction
                    if koala_flip_state:  # Person moved left, so koala faces left
                        koala = cv2.flip(koala, 1)
                    
                    # Ensure koala stays within frame bounds
                    koala_position_y = max(0, min(frame.shape[0] - koala.shape[0], koala_position_y))
                    koala_position_x = max(0, min(frame.shape[1] - koala.shape[1], koala_position_x))
                    
                    # Add a semi-transparent background for better visibility
                    if (koala_position_y + koala.shape[0] <= frame.shape[0] and 
                        koala_position_x + koala.shape[1] <= frame.shape[1]):
                        
                        # Extract the region of interest from the frame
                        roi = frame[koala_position_y:koala_position_y + koala.shape[0], 
                                  koala_position_x:koala_position_x + koala.shape[1]]
                        
                        # Convert koala to BGR (from RGBA)
                        koala_bgr = cv2.cvtColor(koala, cv2.COLOR_RGBA2BGR)
                        alpha = koala[:, :, 3] / 255.0  # Alpha channel (0-1)
                        
                        # Apply stronger alpha blending for better visibility
                        alpha = np.clip(alpha * 1.2, 0, 1)  # Boost alpha for more visibility
                        
                        # Apply alpha blending
                        for c in range(3):
                            roi[:, :, c] = (1 - alpha) * roi[:, :, c] + alpha * koala_bgr[:, :, c]
                        
                        # Place the blended result back in the frame
                        frame[koala_position_y:koala_position_y + koala.shape[0], 
                              koala_position_x:koala_position_x + koala.shape[1]] = roi
                
                # Add status text to show koala is active
                if len(koala_frames) > 0:
                    status_text = f"Koala: {'Active' if front_person is not None else 'Waiting for person'}"
                    cv2.putText(frame, status_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
                # Encode and yield the frame
                _, jpeg = cv2.imencode('.jpg', frame)
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                
        finally:
            cap.release()
            
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


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
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
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
                        logger.error('Camera read failed')
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
                        logger.error('Exception in frame processing: %s', e)
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
            logger.error('Exception in /video-feed-br: %s', e)
            # Return a red error frame
            error_frame = np.zeros((360, 480, 3), dtype=np.uint8)
            cv2.putText(error_frame, 'SERVER ERROR', (10, 200), cv2.FONT_HERSHEY_SIMPLEX, 2, (0,0,255), 6)
            _, jpeg = cv2.imencode('.jpg', error_frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/people_count')
def people_count():
    try:
        model = YOLO('yolov8n-pose.pt')
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            logger.warning("Camera not accessible")
            cap.release()
            return jsonify({'people': 0, 'error': 'Camera not accessible'})
        
        ret, frame = cap.read()
        num_people = 0
        if ret:
            results = model(frame)
            keypoints = results[0].keypoints.xy.cpu().numpy() if results[0].keypoints is not None else []
            num_people = len(keypoints)
        else:
            logger.warning("Could not read frame from camera")
        
        cap.release()
        return jsonify({'people': num_people})
    except Exception as e:
        logger.error("Error in people_count: %s", e)
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'people': 0, 'error': str(e)}), 500


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

@app.route('/speech-to-text', methods=['POST'])
def speech_to_text():
    """
    Fallback speech-to-text endpoint for when Electron IPC is not available
    This is mainly for Windows builds when accessing from game pages
    """
    try:
        import os
        import requests
        import base64
        import io
        
        data = request.get_json()
        if not data or 'audio' not in data:
            return jsonify({'error': 'No audio data provided'}), 400
        
        # Get OpenAI API key from environment
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return jsonify({'error': 'OpenAI API key not configured'}), 500
        
        # Decode base64 audio
        audio_data = base64.b64decode(data['audio'])
        
        # Check audio size
        if len(audio_data) < 1000:
            return jsonify({'error': 'Audio too short - please speak longer'}), 400
        
        # Prepare file for OpenAI Whisper
        files = {
            'file': ('audio.webm', io.BytesIO(audio_data), 'audio/webm'),
            'model': (None, 'whisper-1'),
            'language': (None, 'ko')
        }
        
        headers = {
            'Authorization': f'Bearer {api_key}'
        }
        
        # Call OpenAI Whisper API
        response = requests.post(
            'https://api.openai.com/v1/audio/transcriptions',
            files=files,
            headers=headers,
            timeout=30
        )
        
        if not response.ok:
            return jsonify({'error': f'Whisper API error: {response.status_code}'}), 500
        
        result = response.json()
        
        # Check for fallback responses
        if 'text' in result:
            text = result['text'].strip()
            fallback_responses = ['고맙습니다', '감사합니다', '안녕하세요', 'Thank you', 'Thanks']
            
            if text in fallback_responses:
                return jsonify({'error': 'Audio unclear - please speak louder or closer to microphone'}), 400
            
            if not text:
                return jsonify({'error': 'No speech recognized'}), 400
            
            return jsonify({'text': text})
        else:
            return jsonify({'error': 'No text in Whisper response'}), 500
            
    except Exception as e:
        logging.error(f"Speech-to-text error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Jump Server - Motion Detection Backend')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the server on (default: 5001)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    logger.info(f"Starting Jump Server on {args.host}:{args.port}")
    logger.info(f"Debug mode: {'enabled' if args.debug else 'disabled'}")
    
    try:
        app.run(host=args.host, port=args.port, debug=args.debug, use_reloader=False)
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.error("Server error: %s", e)
    finally:
        logger.info("Server shutting down")