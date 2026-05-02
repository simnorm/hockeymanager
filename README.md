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
- Mobile app version

## Optional Replacement Notifications

When a player marks themselves absent, the server can notify the top replacement candidate selected by the rating algorithm.

Email configuration:

Simplest option: Gmail with an app password.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourleague@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=yourleague@gmail.com
```

Generic SMTP configuration:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM=hockey@example.com
```

For Gmail:

- Turn on 2-step verification for the Gmail account.
- Create an App Password in Google Account settings.
- Use that app password as `SMTP_PASS`.

SMS configuration with Twilio:

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+15555550123
```

SMS configuration with voip.ms:

```bash
SMS_PROVIDER=voipms
VOIPMS_API_USERNAME=your-api-username
VOIPMS_API_PASSWORD=your-api-password
VOIPMS_FROM_NUMBER=15555550123
```

Notes:

- Full setup and message behavior details are in [NOTIFICATION_CONFIGURATION.md](/Users/simon/Documents/src/hockey/NOTIFICATION_CONFIGURATION.md).
- The server will use email, SMS, or both depending on the replacement player's contact info and configured providers.
- If `SMS_PROVIDER` is not set, the server prefers Twilio when Twilio credentials are present, otherwise it uses voip.ms when voip.ms credentials are present.
- Notifications are optional. If no provider is configured, attendance updates still succeed.

