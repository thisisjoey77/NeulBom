@echo off
echo Setting up Neulbom Python backend...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

REM Install required packages
echo Installing Python packages...
pip install opencv-python flask ultralytics numpy

if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python packages
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo ✓ Python backend setup complete!
echo You can now run Neulbom and the motion detection features should work.
echo.
pause
