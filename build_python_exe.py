#!/usr/bin/env python3
"""
Build script for creating platform-specific Python executables
"""

import os
import sys
import subprocess
import platform
import shutil

def get_python_commands():
    """Get available Python commands in order of preference"""
    if platform.system() == 'Windows':
        commands = ['python', 'py', 'python3']
    else:
        commands = ['python3', 'python']
    
    for cmd in commands:
        try:
            result = subprocess.run([cmd, '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"Found Python: {cmd} -> {result.stdout.strip()}")
                return cmd
        except FileNotFoundError:
            continue
    return None

def install_packages():
    """Install required packages"""
    python_cmd = get_python_commands()
    if not python_cmd:
        raise RuntimeError("Python not found")
    
    print(f"Using Python: {python_cmd}")
    
    # Check pip availability
    try:
        result = subprocess.run([python_cmd, '-m', 'pip', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("pip not available")
        print(f"Found pip: {result.stdout.strip()}")
    except FileNotFoundError:
        raise RuntimeError("pip not found")
    
    # Check if requirements.txt exists and use it
    if os.path.exists('requirements.txt'):
        print("📦 Installing packages from requirements.txt...")
        cmd = [python_cmd, '-m', 'pip', 'install', '--upgrade', '-r', 'requirements.txt']
        
        # Handle externally managed environments (like Homebrew Python)
        if platform.system() == 'Darwin':  # macOS
            cmd.extend(['--break-system-packages'])
            print("ℹ️  Using --break-system-packages for macOS Homebrew Python")
        
        print(f"Command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd)
        if result.returncode != 0:
            print("\n⚠️  Package installation failed. Trying alternative approaches...")
            
            # Try with --user flag
            cmd_user = [python_cmd, '-m', 'pip', 'install', '--upgrade', '--user', '-r', 'requirements.txt']
            print(f"Trying with --user: {' '.join(cmd_user)}")
            result = subprocess.run(cmd_user)
            
            if result.returncode != 0:
                print("\n💡 Consider using a virtual environment:")
                print("   python3 -m venv venv")
                print("   source venv/bin/activate  # On Windows: venv\\Scripts\\activate")
                print("   python -m pip install -r requirements.txt")
                print("   python build_python_exe.py")
                raise RuntimeError(f"Package installation from requirements.txt failed with code {result.returncode}")
        
        print("✅ All packages from requirements.txt installed successfully")
    else:
        # Fallback to manual package list
        packages = [
            'flask',
            'flask-cors', 
            'opencv-python',
            'numpy',
            'ultralytics',
            'PyInstaller'
        ]
        
        cmd = [python_cmd, '-m', 'pip', 'install', '--upgrade'] + packages
        
        # Handle externally managed environments
        if platform.system() == 'Darwin':  # macOS
            cmd.extend(['--break-system-packages'])
            print("ℹ️  Using --break-system-packages for macOS Homebrew Python")
        
        print(f"Installing packages: {' '.join(packages)}")
        print(f"Command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd)
        if result.returncode != 0:
            # Try with --user flag
            cmd_user = [python_cmd, '-m', 'pip', 'install', '--upgrade', '--user'] + packages
            print(f"Trying with --user: {' '.join(cmd_user)}")
            result = subprocess.run(cmd_user)
            
            if result.returncode != 0:
                raise RuntimeError(f"Package installation failed with code {result.returncode}")
        
        print("✅ All packages installed successfully")

def build_executable():
    """Build the executable using PyInstaller"""
    python_cmd = get_python_commands()
    if not python_cmd:
        raise RuntimeError("Python not found")
    
    # Check PyInstaller
    try:
        result = subprocess.run([python_cmd, '-m', 'PyInstaller', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("PyInstaller not available")
        print(f"Found PyInstaller: {result.stdout.strip()}")
    except FileNotFoundError:
        raise RuntimeError("PyInstaller not found")
    
    # Ensure directories exist
    os.makedirs('dist', exist_ok=True)
    os.makedirs('build', exist_ok=True)
    
    # Check if jump_server.py exists
    if not os.path.exists('jump_server.py'):
        raise RuntimeError("jump_server.py not found in current directory")
    
    # Check if required model file exists
    if not os.path.exists('yolov8n-pose.pt'):
        print("⚠️  Warning: yolov8n-pose.pt not found. Motion detection may not work.")
        print("   Download from: https://github.com/ultralytics/yolov8/releases/")
    
    # PyInstaller command with enhanced options
    cmd = [
        python_cmd, '-m', 'PyInstaller',
        'jump_server.py',
        '--onefile',
        '--distpath=dist',
        '--workpath=build', 
        '--specpath=.',
        '--name=jump_server',
        '--hidden-import=cv2',
        '--hidden-import=numpy',
        '--hidden-import=ultralytics',
        '--hidden-import=flask',
        '--hidden-import=flask_cors',
        '--collect-all=ultralytics',
        '--noconfirm'
    ]
    
    # Add model file if it exists
    if os.path.exists('yolov8n-pose.pt'):
        cmd.append('--add-data=yolov8n-pose.pt:.')
        print("✓ Including yolov8n-pose.pt model file")
    
    print("Building executable with PyInstaller...")
    print(f"Command: {' '.join(cmd)}")
    
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise RuntimeError(f"PyInstaller failed with code {result.returncode}")
    
    # Check if the executable was created
    exe_name = 'jump_server.exe' if platform.system() == 'Windows' else 'jump_server'
    exe_path = os.path.join('dist', exe_name)
    
    if os.path.exists(exe_path):
        print(f"✓ Executable created: {exe_path}")
        
        # Get file size
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print(f"✓ File size: {size_mb:.1f} MB")
        
        # Make it executable on Unix systems
        if platform.system() != 'Windows':
            os.chmod(exe_path, 0o755)
            print("✓ Set executable permissions")
            
        return exe_path
    else:
        raise RuntimeError(f"Executable not found at: {exe_path}")

def main():
    """Main build function"""
    print("=" * 60)
    print("Building Python executable for Neulbom")
    print("=" * 60)
    print(f"Platform: {platform.system()} {platform.machine()}")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print()
    
    try:
        # Install packages
        print("Step 1: Installing Python packages...")
        install_packages()
        print()
        
        # Build executable
        print("Step 2: Building executable...")
        exe_path = build_executable()
        print()
        
        print("=" * 60)
        print("✓ Build completed successfully!")
        print(f"✓ Executable: {exe_path}")
        print(f"✓ Platform: {platform.system()} {platform.machine()}")
        print()
        print("Next steps:")
        print("- You can now run: npm run build")
        print("- Or test the executable directly")
        print("=" * 60)
        
    except Exception as e:
        print("=" * 60)
        print(f"✗ Build failed: {e}")
        print()
        print("Troubleshooting:")
        print("1. Make sure Python is installed and in PATH")
        print("2. Make sure pip is working: python -m pip --version")
        print("3. Make sure you're in the correct directory (should contain jump_server.py)")
        print("4. Try running: pip install --upgrade pip")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
