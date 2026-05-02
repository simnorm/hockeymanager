import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { Game, Series, GameWithDetails, AttendanceWithPlayer, NotificationLog, TeamWithPlayer } from '../types.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all games
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    console.log(`Fetching all games for league ${req.leagueId}`);
    const games = await allAsync(
      'SELECT * FROM games WHERE league_id = ? ORDER BY date DESC, time DESC',
      [req.leagueId]
    ) as Game[];
    console.log(`Found ${games.length} games:`, games.map(g => ({ id: g.id, league_id: g.league_id, date: g.date })));
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug: Get all games regardless of league (for testing)
router.get('/debug/all-games', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allGames = await allAsync('SELECT id, league_id, date FROM games ORDER BY id DESC LIMIT 10') as any[];
    res.json({ debug: true, games: allGames });
  } catch (error) {
    res.status(500).json({ error: 'Debug query failed', details: String(error) });
  }
});

// Get game by ID with details
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const gameId = parseInt(req.params.id, 10);
    console.log(`\n=== Fetching game ${gameId} for league ${req.leagueId} ===`);
    
    // First check if game exists at all
    const anyGame = await getAsync('SELECT id, league_id, date FROM games WHERE id = ?', [gameId]) as any;
    console.log(`Game lookup: ${gameId} ->`, anyGame ? { id: anyGame.id, league_id: anyGame.league_id } : 'NOT FOUND');
    
    const game = await getAsync('SELECT * FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as Game;

    if (!game) {
      if (anyGame) {
        console.log(`MISMATCH: Game ${gameId} exists in league ${anyGame.league_id} but user is in league ${req.leagueId}`);
        return res.status(403).json({ error: 'Game exists but not in your current league' });
      } else {
        console.log(`Game ${gameId} not found in database`);
      }
      return res.status(404).json({ error: 'Game not found' });
    }

    let series: Series | undefined;
    if (game.series_id) {
      series = await getAsync('SELECT * FROM series WHERE id = ? AND league_id = ?', [game.series_id, req.leagueId]) as Series;
    }

    // Get attendance
    const attendance = await allAsync(
      `SELECT
         COALESCE(a.id, -p.id) as id,
         ? as game_id,
         p.id as player_id,
         COALESCE(a.status, 'pending') as status,
         a.responded_at,
         p.user_id,
         p.name as player_name,
         p.is_regular
       FROM players p
       JOIN player_leagues pl ON pl.player_id = p.id
       LEFT JOIN attendance a ON a.player_id = p.id AND a.game_id = ?
       WHERE pl.league_id = ? AND p.is_active = 1
       ORDER BY p.is_regular DESC, p.name`,
      [game.id, game.id, req.leagueId]
    ) as AttendanceWithPlayer[];

    // Get teams, from series if game belongs to one
    const teamTarget = game.series_id ? 't.series_id = ?' : 't.game_id = ?';
    const teamTargetId = game.series_id || game.id;
    const teams = await allAsync(`
      SELECT t.team_number, t.player_id, p.name as player_name, p.position, t.team_name
      FROM teams t
      JOIN players p ON t.player_id = p.id
      JOIN player_leagues pl ON pl.player_id = p.id
      WHERE ${teamTarget} AND pl.league_id = ?
      ORDER BY t.team_number, p.name
    `, [teamTargetId, req.leagueId]) as TeamWithPlayer[];

    const notificationLogs = await allAsync(
      `SELECT
         nl.*, 
         absent_player.name as absent_player_name
       FROM notification_logs nl
       LEFT JOIN players absent_player ON absent_player.id = nl.absent_player_id
       WHERE nl.game_id = ?
       ORDER BY nl.created_at DESC, nl.id DESC`,
      [game.id]
    ) as NotificationLog[];

    const gameWithDetails: GameWithDetails = {
      ...game,
      attendance,
      teams,
      series,
      notificationLogs,
    };

    res.json(gameWithDetails);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create game (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId || req.leagueId <= 0) {
      console.error('Invalid league context:', { userId: req.userId, leagueId: req.leagueId });
      return res.status(403).json({ error: 'Valid league context required' });
    }

    const { date, time, location, series_id } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Verify league exists
    const league = await getAsync('SELECT id FROM leagues WHERE id = ?', [req.leagueId]);
    if (!league) {
      console.error('League not found:', req.leagueId);
      return res.status(403).json({ error: 'League not found' });
    }

    let seriesIdValue = null;
    if (series_id !== undefined && series_id !== null) {
      const series = await getAsync('SELECT id FROM series WHERE id = ? AND league_id = ?', [series_id, req.leagueId]);
      if (!series) {
        return res.status(400).json({ error: 'Series not found for this league' });
      }
      seriesIdValue = series_id;
    }

    // Verify league_id will be set in database
    console.log(`Creating game in league ${req.leagueId} for user ${req.userId}`);
    
    const result = await runAsync(
      'INSERT INTO games (league_id, series_id, date, time, location) VALUES (?, ?, ?, ?, ?)',
      [req.leagueId, seriesIdValue, date, time || null, location || null]
    );

    if (!result.lastID) {
      console.error('Failed to get lastID after game insertion');
      return res.status(500).json({ error: 'Failed to create game' });
    }

    console.log(`Game created: ID=${result.lastID}, LeagueID=${req.leagueId}`);

    // Create attendance records for all active players
    const players = await allAsync(
      `SELECT p.id
       FROM players p
       JOIN player_leagues pl ON pl.player_id = p.id
       WHERE pl.league_id = ? AND p.is_active = 1`,
      [req.leagueId]
    ) as { id: number }[];

    for (const player of players) {
      await runAsync(
        'INSERT INTO attendance (game_id, player_id, status) VALUES (?, ?, ?)',
        [result.lastID, player.id, 'pending']
      );
    }

    const game = await getAsync('SELECT * FROM games WHERE id = ?', [result.lastID]) as Game;
    if (!game) {
      console.error(`Failed to retrieve created game with ID ${result.lastID}`);
      return res.status(500).json({ error: 'Failed to retrieve created game' });
    }

    // Verify game has correct league_id
    if (game.league_id !== req.leagueId) {
      console.error(`League mismatch: Game league_id=${game.league_id}, expected=${req.leagueId}`);
      return res.status(500).json({ error: 'Game created with wrong league context' });
    }

    console.log(`Game retrieved successfully:`, { id: game.id, league_id: game.league_id, date: game.date });
    res.status(201).json(game);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update game (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { date, time, location, status, team1_score, team2_score, series_id } = req.body;

    let seriesIdValue = null;
    if (series_id !== undefined && series_id !== null) {
      const series = await getAsync('SELECT id FROM series WHERE id = ? AND league_id = ?', [series_id, req.leagueId]);
      if (!series) {
        return res.status(400).json({ error: 'Series not found for this league' });
      }
      seriesIdValue = series_id;
    }

    await runAsync(
      'UPDATE games SET date = ?, time = ?, location = ?, status = ?, team1_score = ?, team2_score = ?, series_id = ? WHERE id = ? AND league_id = ?',
      [
        date,
        time || null,
        location || null,
        status,
        team1_score || null,
        team2_score || null,
        seriesIdValue,
        req.params.id,
        req.leagueId,
      ]
    );

    const game = await getAsync('SELECT * FROM games WHERE id = ? AND league_id = ?', [
      req.params.id,
      req.leagueId,
    ]) as Game;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete game (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    await runAsync('DELETE FROM games WHERE id = ? AND league_id = ?', [req.params.id, req.leagueId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
