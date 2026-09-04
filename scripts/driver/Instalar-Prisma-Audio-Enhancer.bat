@echo off
title Instalador - Prisma Audio Enhancer
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit -ExecutionPolicy Bypass -File \"\"%~dp0install-prisma-driver.ps1\"\"'"
