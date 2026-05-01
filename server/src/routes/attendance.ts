import express, { Request, Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { Attendance } from '../types.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

interface ReplacementCandidate {
  player_id: number;
  name: string;
  position: 'forward' | 'defense' | 'goalie';
  is_regular: number;
  forward_rating: number;
  defense_rating: number;
  goalie_rating: number;
  offense_weight: number;
  defense_weight: number;
}

function replacementScore(player: ReplacementCandidate): number {
  if (player.position === 'goalie') {
    return player.goalie_rating;
  }

  if (player.position === 'defense') {
    return player.defense_rating * 2 + player.defense_weight;
  }

  return player.forward_rating * 2 + player.offense_weight;
}

// Update attendance status
router.put('/:gameId/:playerId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId || !req.userId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { gameId, playerId } = req.params;
    const { status } = req.body;

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "present" or "absent"' });
    }

    const game = await getAsync('SELECT id FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as { id: number } | undefined;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const targetPlayer = await getAsync(
      'SELECT id, user_id FROM players WHERE id = ? AND league_id = ?',
      [playerId, req.leagueId]
    ) as { id: number; user_id: number | null } | undefined;

    if (!targetPlayer) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (!req.isAdmin && targetPlayer.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only update your own attendance' });
    }

    // Check if attendance record exists
    const existing = await getAsync(
      'SELECT * FROM attendance WHERE game_id = ? AND player_id = ?',
      [gameId, playerId]
    ) as Attendance;

    if (!existing) {
      // Create attendance record if it doesn't exist
      await runAsync(
        'INSERT INTO attendance (game_id, player_id, status, responded_at) VALUES (?, ?, ?, datetime("now"))',
        [gameId, playerId, status]
      );
    } else {
      // Update existing record
      await runAsync(
        'UPDATE attendance SET status = ?, responded_at = datetime("now") WHERE game_id = ? AND player_id = ?',
        [status, gameId, playerId]
      );
    }

    const attendance = await getAsync(
      'SELECT * FROM attendance WHERE game_id = ? AND player_id = ?',
      [gameId, playerId]
    ) as Attendance;

    let replacementSuggestions: Array<{
      playerId: number;
      name: string;
      isRegular: boolean;
      score: number;
    }> = [];
    let replacementMessage: string | undefined;

    if (status === 'absent') {
      const teamAssignment = await getAsync(
        'SELECT team_number FROM teams WHERE game_id = ? AND player_id = ?',
        [gameId, playerId]
      ) as { team_number: number } | undefined;

      if (teamAssignment) {
        const absentPlayer = await getAsync(
          `SELECT
            id as player_id,
            name,
            position,
            is_regular,
            forward_rating,
            defense_rating,
            goalie_rating,
            offense_weight,
            defense_weight
          FROM players
          WHERE id = ? AND league_id = ?`,
          [playerId, req.leagueId]
        ) as ReplacementCandidate | undefined;

        if (absentPlayer) {
          const absentScore = replacementScore(absentPlayer);

          const candidates = await allAsync(
            `SELECT
              p.id as player_id,
              p.name,
              p.position,
              p.is_regular,
              p.forward_rating,
              p.defense_rating,
              p.goalie_rating,
              p.offense_weight,
              p.defense_weight
            FROM players p
            LEFT JOIN attendance a ON a.player_id = p.id AND a.game_id = ?
            LEFT JOIN teams t ON t.player_id = p.id AND t.game_id = ?
            WHERE p.league_id = ?
              AND p.is_active = 1
              AND p.position = ?
              AND p.id != ?
              AND t.player_id IS NULL
              AND (a.status IS NULL OR a.status != 'absent')`,
            [gameId, gameId, req.leagueId, absentPlayer.position, playerId]
          ) as ReplacementCandidate[];

          const scoredCandidates = candidates
            .map((candidate) => ({
              ...candidate,
              score: replacementScore(candidate),
            }))
            .sort((a, b) => {
              const aDiff = Math.abs(a.score - absentScore);
              const bDiff = Math.abs(b.score - absentScore);
              if (aDiff === bDiff) {
                return b.score - a.score;
              }
              return aDiff - bDiff;
            });

          const similarlyRatedOrBetter = scoredCandidates.filter((candidate) => candidate.score >= absentScore);
          const selected = similarlyRatedOrBetter.slice(0, 3);

          replacementSuggestions = selected.map((candidate) => ({
            playerId: candidate.player_id,
            name: candidate.name,
            isRegular: candidate.is_regular === 1,
            score: candidate.score,
          }));

          if (replacementSuggestions.length > 0) {
            replacementMessage = `Team ${teamAssignment.team_number}: contact a replacement for ${absentPlayer.name}.`;
          } else if (scoredCandidates.length > 0) {
            replacementMessage = `No similarly rated or better ${absentPlayer.position} available for ${absentPlayer.name}.`;
          } else {
            replacementMessage = `No available ${absentPlayer.position} replacements found for ${absentPlayer.name}.`;
          }
        }
      }
    }

    res.json({
      attendance,
      replacementSuggestions,
      replacementMessage,
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
