# Notification Configuration

This file explains how replacement notifications are configured in the hockey app.

## What the app does

When a player marks themselves absent:

1. The server updates attendance.
2. If the absent player was assigned to a team, the server selects the best replacement candidate using the rating algorithm.
3. The server attempts to send:
   - an email if the replacement player has an email and SMTP is configured
   - an SMS if the replacement player has a phone number and an SMS provider is configured
4. The delivery attempt is written to the notification log.

Admins can also send a test notification from the game detail page.

## Environment file

Use [server/.env.example](/Users/simon/Documents/src/hockey/server/.env.example) as the template for your server `.env` file.

## Gmail setup

Gmail is the easiest email option for a small private league.

Required variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourleague@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=yourleague@gmail.com
```

Steps:

1. Create or choose a Gmail account for the league.
2. Enable 2-Step Verification on that Google account.
3. Create an App Password in the Google account security settings.
4. Put the app password into `SMTP_PASS`.
5. Restart the server after updating `.env`.

Notes:

1. Do not use your normal Gmail password as `SMTP_PASS`.
2. `SMTP_FROM` is the sender address players will see.

## SMS setup with Twilio

Required variables:

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+15555550123
```

Notes:

1. `TWILIO_FROM_NUMBER` must be a Twilio number that can send SMS.
2. Twilio trial accounts usually only send to verified recipient numbers.

## SMS setup with voip.ms

Required variables:

```env
SMS_PROVIDER=voipms
VOIPMS_API_USERNAME=your-api-username
VOIPMS_API_PASSWORD=your-api-password
VOIPMS_FROM_NUMBER=15555550123
```

Notes:

1. `VOIPMS_FROM_NUMBER` should be the DID used as the SMS sender.
2. The DID must support SMS in your `voip.ms` account.
3. The app currently sends SMS through the `sendSMS` REST endpoint.

## Provider selection

The server uses `SMS_PROVIDER` to choose the SMS provider.

Valid values:

1. `twilio`
2. `voipms`

If `SMS_PROVIDER` is omitted:

1. The server prefers Twilio when Twilio credentials are present.
2. Otherwise it falls back to `voip.ms` when those credentials are present.

## Player contact requirements

For a replacement notification to be delivered:

1. The selected replacement player must have an email for email delivery.
2. The selected replacement player must have a phone number for SMS delivery.

If a replacement player has both, the app can send both.

## Notification log

Notification attempts are stored in the database and shown on the game detail page for admins.

The log records:

1. whether the trigger was an absence or a test notification
2. who the recipient was
3. whether delivery was `sent`, `skipped`, or `failed`
4. which channels were used: email, SMS, or both
5. which SMS provider was used
6. the logged reason when the send was skipped or failed

## Test notifications

Admins can send a test notification from a game detail page.

This is useful for verifying:

1. Gmail SMTP works
2. Twilio or `voip.ms` works
3. recipient contact formatting is acceptable

Test notifications are also written into the notification log.

## Message templates

The message templates are currently defined in [server/src/services/notifications.ts](/Users/simon/Documents/src/hockey/server/src/services/notifications.ts).

Current templates:

1. Replacement email message
2. Replacement SMS message
3. Test email message
4. Test SMS message

If you want different wording, edit the message-building code in that file.

## Restart requirement

After changing any notification environment variable:

1. restart the server

The app reads notification configuration from environment variables at runtime.