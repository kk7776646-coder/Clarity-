@echo off
cd /d "%~dp0\.."
call .venv\Scripts\activate.bat
set PYTHONPATH=.
python server\app.py
