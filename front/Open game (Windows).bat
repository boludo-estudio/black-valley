@echo off
cd /d "%~dp0"
start "" http://localhost:8872/
python serve.py 8872
