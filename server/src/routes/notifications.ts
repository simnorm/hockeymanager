import express, { Response } from 'express';
import { getAsync } from '../database.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { logNotificationResult, notifyTestRecipient } from '../services/notifications.js';

const router = express.Router();

router.post('/test', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { recipientName, email, phone, gameId } = req.body as {
      recipientName?: string;
      email?: string;
      phone?: string;
      gameId?: number;
    };

    const normalizedName = String(recipientName || '').trim() || 'Test Recipient';
    const normalizedEmail = String(email || '').trim() || undefined;
    const normalizedPhone = String(phone || '').trim() || undefined;

    if (!normalizedEmail && !normalizedPhone) {
      return res.status(400).json({ error: 'Email or phone is required' });
    }

    let resolvedGameId: number | undefined;
    if (gameId) {
      if (!req.leagueId) {
        return res.status(403).json({ error: 'League context required' });
      }

      const game = await getAsync('SELECT id FROM games WHERE id = ? AND league_id = ?', [
        gameId,
        req.leagueId,
      ]) as { id: number } | undefined;

      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      resolvedGameId = game.id;
    }

    const result = await notifyTestRecipient({
      recipientName: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
    });

    await logNotificationResult({
      gameId: resolvedGameId,
      triggerType: 'test',
      recipientName: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      initiatedByUserId: req.userId,
      result,
    });

    return res.json({ result });
  } catch (error) {
    console.error('Test notification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;