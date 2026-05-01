# Hockey League Management System

A web application for managing a hockey league with 22 regular players and substitutes.

## Features

- **Player Management**: Track regular players and substitutes
- **Attendance Tracking**: Players can confirm if they're present or absent for each game
- **Team Creation**: Admin can create balanced teams for each game
- **Game Results**: Keep track of scores and results for each game
- **Mobile Responsive**: Works on all devices

## Tech Stack

- **Frontend**: React + TypeScript + Material-UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Running the Application

Development mode (runs both client and server):

```bash
npm run dev
```

The frontend will be available at http://localhost:3000
The backend API will be available at http://localhost:5000

### Default Admin Credentials

- Username: admin
- Password: admin123

**Important**: Change these credentials after first login!

## Project Structure

```
hockey/
├── client/          # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── types/
├── server/          # Express backend
│   └── src/
│       ├── routes/
│       ├── models/
│       └── middleware/
└── package.json
```

## Future Enhancements

- Player statistics tracking
- Season standings
- Email notifications
- Mobile app version
