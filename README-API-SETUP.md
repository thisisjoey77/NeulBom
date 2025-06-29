# Setting up Environment Variables for API Keys

## Overview
This project now uses a **single unified Python server** that handles both:
- 🖼️ Computer vision (pose detection, people counting)  
- 🤖 OpenAI API calls (secure and hidden from frontend)

## Setup Instructions

### 1. Install Python Dependencies
```bash
cd /Users/joykim/Desktop/코알라/newAttempt
pip install flask flask-cors opencv-python ultralytics numpy openai python-dotenv
```

### 2. Set up Environment Variables
Copy the example file and add your API key:
```bash
cp .env.example .env
```
Then edit `.env` and replace `your_openai_api_key_here` with your actual OpenAI API key:
```
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### 3. Start the Unified Server
```bash
python jump_server.py
```
Server will start on: `http://localhost:5000`

### 4. Open Your Games
Open any HTML file in your browser - they'll automatically connect to the Python server for both computer vision and AI features.

## 🔒 GitHub Safety

### What Gets Uploaded to GitHub:
✅ **Safe to upload:**
- All `.js`, `.html`, `.css` files (no API keys)
- `jump_server.py` (no hardcoded keys)
- `api-helper.js` (no keys, just helper functions)
- `.gitignore` (protects sensitive files)
- `.env.example` (template without real keys)
- `README-API-SETUP.md` (this file)
- `requirements.txt` (Python dependencies)

❌ **Protected by .gitignore:**
- `.env` (contains your actual API key)
- `node_modules/` (if you have any Node.js dependencies)
- OS-specific files (`.DS_Store`, etc.)

### For Deployment on Web Hosting:
1. **Upload your Python project** to your hosting service
2. **Set environment variables** on the hosting platform:
   - Add `OPENAI_API_KEY=your-key` in hosting dashboard
3. **Install Python dependencies** on the server:
   ```bash
   pip install -r requirements.txt
   ```
4. **Run the Python server** (most hosts auto-detect Flask apps)

### For Team Collaboration:
1. Team members clone the repository
2. They create their own `.env` file with their API key
3. They run `pip install -r requirements.txt`
4. They run `python jump_server.py`
5. **Your API key stays completely private!**

## 🎮 Available Games & Features

All games work through the unified Python server:

### Computer Vision Games:
- **369 Game** (`369.html`) - Math game with people counting
- **Jump Game** (`temp.html`) - Synchronized jumping detection  
- **BR31 Game** (`br31.html`) - Jump counting game
- **Last Word Game** (`lastWord.html`) - Word game with people detection

### AI-Powered Games:
- **Story Time** (`storyTime.html`) - Collaborative storytelling with AI
- **Telephone Game** (`telephoneGame.html`) - Action verification with AI
- **Guess Person** (`guessPerson.html`) - 20 questions about people
- **Twenty Questions** (`twentyQ.html`) - Classic guessing game
- **Image Guess** (`imageGuess.html`) - Animal description game

### Main Interface:
- **Home** (`index.html`) - Main AI conversation interface

## 🔧 Technical Details

### Single Server Architecture:
- **Port 5000**: Unified Python server handles everything
- **Flask + OpenCV + OpenAI**: All functionality in one place
- **No separate Node.js server needed**: Simplified deployment

### API Endpoints:
- `/api/openai` - Secure OpenAI API proxy
- `/people_count` - Real-time people detection
- `/jump_count` - Jump detection for games  
- `/video_feed*` - Computer vision video streams

This setup is **much simpler for deployment** than having separate servers!
3. **`.env`** - Your actual file with real keys (WILL NOT be committed)

### Before Pushing to GitHub:
```bash
# Check what files will be committed
git status

# You should NOT see .env in the list
# You SHOULD see .env.example

# If .env appears, make sure .gitignore is working:
git check-ignore .env
# Should output: .env
```

### Setting up on another machine:
```bash
git clone your-repo-url
cd your-repo
cp .env.example .env
# Edit .env with actual API keys
npm install
npm start
```

## Files that need updating:
- firstSoundGame.js
- telephoneGame.js  
- storyTime.js
- guessPerson.js
- twentyQ.js
- script.js

## Benefits:
- ✅ API key is secure on server-side
- ✅ No API key exposed in client code
- ✅ Safe to upload to GitHub
- ✅ Easy to manage environment variables
- ✅ Can add rate limiting, logging, etc. on server
- ✅ Works across all your games

## Running:
1. Start the API server: `npm start` (runs on port 3001)
2. Start your Python server: `python jump_server.py` (runs on port 5000)  
3. Open your HTML files in browser

## Security Notes:
- ❌ **NEVER** commit `.env` files to Git
- ✅ **ALWAYS** use `.env.example` for templates
- ✅ **ALWAYS** add `.env` to `.gitignore`
- ✅ **USE** server-side API calls for production
