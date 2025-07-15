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
app = Flask(__name__)
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


@app.route('/')
def index():
    return send_file('temp.html')


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