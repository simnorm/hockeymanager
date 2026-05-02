import nodemailer from 'nodemailer';
import twilio from 'twilio';
import https from 'node:https';
import { runAsync } from '../database.js';

export type NotificationChannel = 'email' | 'sms';
type SmsProvider = 'twilio' | 'voipms';
export type NotificationReason =
  | 'no-candidate'
  | 'no-contact-method'
  | 'no-provider-configured'
  | 'delivery-failed';

export interface ReplacementNotificationResult {
  status: 'sent' | 'skipped' | 'failed';
  recipientName?: string;
  recipientPlayerId?: number;
  channelsSent: NotificationChannel[];
  provider?: SmsProvider;
  reason?: NotificationReason;
}

export interface NotificationLogInput {
  gameId?: number;
  triggerType: 'absence' | 'test';
  absentPlayerId?: number;
  recipientPlayerId?: number;
  recipientName?: string;
  email?: string | null;
  phone?: string | null;
  initiatedByUserId?: number;
  result: ReplacementNotificationResult;
}

interface DirectNotificationInput {
  recipientName: string;
  recipientPlayerId?: number;
  email?: string | null;
  phone?: string | null;
  emailSubject: string;
  emailText: string;
  smsBody: string;
}

interface ReplacementNotificationInput {
  recipientName: string;
  recipientPlayerId: number;
  email?: string | null;
  phone?: string | null;
  absentPlayerName: string;
  gameDate: string;
  gameTime?: string | null;
  gameLocation?: string | null;
  leagueName?: string | null;
  teamNumber: number;
}

let mailTransporter: nodemailer.Transporter | null | undefined;
let smsClient: ReturnType<typeof twilio> | null | undefined;

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

function isSmsConfigured() {
  const provider = getSmsProvider();

  if (provider === 'voipms') {
    return isVoipMsConfigured();
  }

  if (provider === 'twilio') {
    return isTwilioConfigured();
  }

  return false;
}

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

function isVoipMsConfigured() {
  return Boolean(
    process.env.VOIPMS_API_USERNAME &&
      process.env.VOIPMS_API_PASSWORD &&
      process.env.VOIPMS_FROM_NUMBER
  );
}

function getSmsProvider(): SmsProvider | null {
  const configuredProvider = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === 'voipms') {
    return isVoipMsConfigured() ? 'voipms' : null;
  }

  if (configuredProvider === 'twilio') {
    return isTwilioConfigured() ? 'twilio' : null;
  }

  if (isTwilioConfigured()) {
    return 'twilio';
  }

  if (isVoipMsConfigured()) {
    return 'voipms';
  }

  return null;
}

function getMailTransporter() {
  if (mailTransporter !== undefined) {
    return mailTransporter;
  }

  if (!isEmailConfigured()) {
    mailTransporter = null;
    return mailTransporter;
  }

  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  return mailTransporter;
}

function getSmsClient() {
  if (smsClient !== undefined) {
    return smsClient;
  }

  if (!isSmsConfigured()) {
    smsClient = null;
    return smsClient;
  }

  smsClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return smsClient;
}

function normalizePhoneNumber(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }

  return trimmed.replace(/\D/g, '');
}

function sendVoipMsSms(to: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      api_username: process.env.VOIPMS_API_USERNAME || '',
      api_password: process.env.VOIPMS_API_PASSWORD || '',
      method: 'sendSMS',
      did: process.env.VOIPMS_FROM_NUMBER || '',
      dst: normalizePhoneNumber(to),
      message: body,
    });

    const requestUrl = `https://voip.ms/api/v1/rest.php?${params.toString()}`;

    https
      .get(requestUrl, (response) => {
        let rawData = '';

        response.on('data', (chunk) => {
          rawData += chunk;
        });

        response.on('end', () => {
          try {
            const parsed = JSON.parse(rawData) as {
              status?: string;
              sms?: { success?: string; error?: string };
              error?: string;
            };

            const success = parsed.status === 'success' || parsed.sms?.success === '1';
            if (!success) {
              reject(new Error(parsed.error || parsed.sms?.error || 'voip.ms SMS failed'));
              return;
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function formatGameDetails(input: ReplacementNotificationInput) {
  const dateLabel = new Date(input.gameDate).toLocaleDateString('en-CA');
  const timeLabel = input.gameTime ? ` at ${input.gameTime}` : '';
  const locationLabel = input.gameLocation ? ` at ${input.gameLocation}` : '';
  const leagueLabel = input.leagueName ? ` for ${input.leagueName}` : '';

  return `${dateLabel}${timeLabel}${locationLabel}${leagueLabel}`;
}

function buildEmailContent(input: ReplacementNotificationInput) {
  const gameDetails = formatGameDetails(input);
  const subject = `Hockey League / Ligue de hockey: replacement request`;
  const text = [
    `Hi ${input.recipientName},`,
    ``,
    `${input.absentPlayerName} is now unavailable for Team ${input.teamNumber} on ${gameDetails}.`,
    `You were selected as the best available replacement. Please contact the organizer if you can play.`,
    ``,
    `Bonjour ${input.recipientName},`,
    ``,
    `${input.absentPlayerName} est maintenant absent pour l'equipe ${input.teamNumber} le ${gameDetails}.`,
    `Vous avez ete choisi comme meilleur remplacement disponible. Veuillez contacter l'organisateur si vous pouvez jouer.`,
  ].join('\n');

  return { subject, text };
}

function buildSmsBody(input: ReplacementNotificationInput) {
  const gameDetails = formatGameDetails(input);

  return [
    `Hockey League: ${input.absentPlayerName} is out for Team ${input.teamNumber} on ${gameDetails}.`,
    `You are the top replacement. Contact the organizer if available.`,
    `Ligue de hockey: ${input.absentPlayerName} est absent pour l'equipe ${input.teamNumber} le ${gameDetails}.`,
    `Vous etes le meilleur remplacement. Contactez l'organisateur si vous etes disponible.`,
  ].join(' ');
}

export async function notifyReplacementCandidate(
  input: ReplacementNotificationInput
): Promise<ReplacementNotificationResult> {
  return notifyDirectRecipient({
    recipientName: input.recipientName,
    recipientPlayerId: input.recipientPlayerId,
    email: input.email,
    phone: input.phone,
    emailSubject: buildEmailContent(input).subject,
    emailText: buildEmailContent(input).text,
    smsBody: buildSmsBody(input),
  });
}

export async function notifyTestRecipient(input: {
  recipientName: string;
  email?: string | null;
  phone?: string | null;
}): Promise<ReplacementNotificationResult> {
  const emailSubject = 'Hockey League / Ligue de hockey: test notification';
  const emailText = [
    `Hi ${input.recipientName},`,
    ``,
    `This is a test notification from the hockey league app.`,
    ``,
    `Bonjour ${input.recipientName},`,
    ``,
    `Ceci est une notification de test de l'application de ligue de hockey.`,
  ].join('\n');
  const smsBody = [
    `Hockey League test notification.`,
    `Ligue de hockey notification de test.`,
  ].join(' ');

  return notifyDirectRecipient({
    recipientName: input.recipientName,
    email: input.email,
    phone: input.phone,
    emailSubject,
    emailText,
    smsBody,
  });
}

async function notifyDirectRecipient(
  input: DirectNotificationInput
): Promise<ReplacementNotificationResult> {
  const result: ReplacementNotificationResult = {
    status: 'skipped',
    recipientName: input.recipientName,
    recipientPlayerId: input.recipientPlayerId,
    channelsSent: [],
  };

  const hasEmail = Boolean(input.email);
  const hasPhone = Boolean(input.phone);
  if (!hasEmail && !hasPhone) {
    return { ...result, reason: 'no-contact-method' };
  }

  const emailConfigured = isEmailConfigured();
  const smsProvider = getSmsProvider();
  const smsConfigured = Boolean(smsProvider);
  if (!emailConfigured && !smsConfigured) {
    return { ...result, reason: 'no-provider-configured' };
  }

  const sendFailures: NotificationChannel[] = [];

  if (hasEmail && emailConfigured) {
    try {
      const transporter = getMailTransporter();
      await transporter?.sendMail({
        from: process.env.SMTP_FROM,
        to: input.email ?? undefined,
        subject: input.emailSubject,
        text: input.emailText,
      });

      result.channelsSent.push('email');
    } catch (error) {
      console.error('Failed to send replacement email:', error);
      sendFailures.push('email');
    }
  }

  if (hasPhone && smsConfigured) {
    try {
      if (smsProvider === 'voipms') {
        await sendVoipMsSms(input.phone as string, input.smsBody);
      } else {
        const client = getSmsClient();
        await client?.messages.create({
          from: process.env.TWILIO_FROM_NUMBER,
          to: input.phone as string,
          body: input.smsBody,
        });
      }

      result.channelsSent.push('sms');
      result.provider = smsProvider ?? undefined;
    } catch (error) {
      console.error('Failed to send replacement SMS:', error);
      sendFailures.push('sms');
    }
  }

  if (result.channelsSent.length > 0) {
    return { ...result, status: 'sent' };
  }

  return {
    ...result,
    status: sendFailures.length > 0 ? 'failed' : 'skipped',
    reason: sendFailures.length > 0 ? 'delivery-failed' : 'no-provider-configured',
  };
}

export async function logNotificationResult(input: NotificationLogInput): Promise<void> {
  await runAsync(
    `INSERT INTO notification_logs (
      game_id,
      trigger_type,
      absent_player_id,
      recipient_player_id,
      recipient_name,
      email,
      phone,
      status,
      channels_sent,
      provider,
      reason,
      initiated_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.gameId ?? null,
      input.triggerType,
      input.absentPlayerId ?? null,
      input.recipientPlayerId ?? input.result.recipientPlayerId ?? null,
      input.recipientName ?? input.result.recipientName ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.result.status,
      input.result.channelsSent.join(',') || null,
      input.result.provider ?? null,
      input.result.reason ?? null,
      input.initiatedByUserId ?? null,
    ]
  );
}