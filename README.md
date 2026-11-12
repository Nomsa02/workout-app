
# Workout App

A full-stack fitness tracking application built with React Native, TypeScript, Python, and FastAPI.

The application helps users organise workouts and import exercise routines from text into structured workout data.

## Tech Stack

**Frontend**
- React Native
- Expo
- TypeScript

**Backend**
- Python
- FastAPI
- Pydantic

## Features

- Mobile workout tracking interface
- Text-based workout importer
- Extraction of exercise names, sets and repetitions
- Workout data validation using Pydantic
- REST API integration between the mobile app and backend

## How It Works

The workout importer uses Python text processing and regular expressions to identify workout information from user-provided text.

The FastAPI backend converts recognised exercise instructions into structured workout data that the mobile application can use.

## Getting Started

### Backend

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API documentation: http://localhost:8000/docs

### Mobile App

Open a second terminal:

```bash
cd mobile
npm install
npx expo start
```

Use Expo Go or a compatible emulator to run the application. Configure the mobile app's API address to point to your running backend. When testing on a physical phone, use your Mac's local network IP address rather than localhost.

## Project Status

**In active development**

Current work focuses on workout importing, mobile functionality and backend integration.

Planned improvements include more advanced workout management, progress tracking and enhanced exercise recommendations.

## Author

Nomsa Malaba

GitHub: https://github.com/Nomsa02
