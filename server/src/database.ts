import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(path.join(__dirname, '../../hockey.db'));

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Promisify database methods
const runAsync = (sql: string, params: any[] = []) => {
  return new Promise<any>((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getAsync = (sql: string, params: any[] = []) => {
  return new Promise<any>((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allAsync = (sql: string, params: any[] = []) => {
  return new Promise<any[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function columnExists(table: string, column: string): Promise<boolean> {
  const columns = await allAsync(`PRAGMA table_info(${table})`);
  return columns.some((col) => col.name === column);
}

// Seed test data
async function seedTestData() {
  try {
    // Check if Test League already exists
    const testLeague = await getAsync(
      'SELECT id FROM leagues WHERE name = ?',
      ['Test League']
    ) as { id: number } | undefined;

    let testLeagueId: number;

    if (!testLeague) {
      // Create Test League
      const result = await runAsync(
        'INSERT INTO leagues (name) VALUES (?)',
        ['Test League']
      );
      testLeagueId = result.lastID;
      console.log('Test League created');
    } else {
      testLeagueId = testLeague.id;
      // Check if test data already exists
      const existingPlayers = await getAsync(
        'SELECT COUNT(*) as count FROM players WHERE league_id = ?',
        [testLeagueId]
      ) as { count: number };

      if (existingPlayers.count > 0) {
        console.log('Test data already exists, skipping seed');
        return;
      }
    }

    const firstNames = [
      'Alex', 'Brandon', 'Chris', 'David', 'Eric', 'Frank', 'George', 'Henry', 'Isaac', 'James',
      'Kevin', 'Liam', 'Michael', 'Nathan', 'Oliver', 'Patrick', 'Quinn', 'Ryan', 'Scott', 'Tyler',
      'Vincent', 'William', 'Xavier', 'Zachary',
    ];

    const lastNames = [
      'Anderson', 'Bennett', 'Carter', 'Davis', 'Evans', 'Fisher', 'Garcia', 'Harrison', 'Jackson', 'King',
      'Lewis', 'Martinez', 'Nelson', 'O\'Brien', 'Patterson', 'Quinn', 'Richardson', 'Smith', 'Taylor', 'Unger',
      'Vance', 'Walker', 'Young', 'Zimmerman',
    ];

    const getRandomName = () => {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      return `${firstName} ${lastName}`;
    };

    const getRandomRating = (min = 3, max = 10) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomEmail = (name: string) => `${name.toLowerCase().replace(/\s+/g, '.')}@exemple.com`;

    // Create 22 regular players: 12 forwards, 8 defensemen, 2 goalies
    const regularPlayers = [];

  // 12 Forwards
  for (let i = 0; i < 12; i++) {
    const fwdPos = i < 5 ? '["center","winger"]' : i < 8 ? '["center"]' : '["winger"]';
    regularPlayers.push({
      name: getRandomName(),
      position: 'forward' as const,
      forward_positions: fwdPos,
      is_regular: 1,
      offense_weight: getRandomRating(6, 10),
      defense_weight: getRandomRating(4, 8),
      defense_rating: getRandomRating(4, 7),
      forward_rating: getRandomRating(6, 10),
      goalie_rating: getRandomRating(2, 4),
    });
  }

    // 8 Defensemen
    for (let i = 0; i < 8; i++) {
      regularPlayers.push({
        name: getRandomName(),
        position: 'defense' as const,
        is_regular: 1,
        offense_weight: getRandomRating(4, 7),
        defense_weight: getRandomRating(6, 10),
        defense_rating: getRandomRating(6, 10),
        forward_rating: getRandomRating(4, 8),
        goalie_rating: getRandomRating(2, 4),
      });
    }

    // 2 Goalies
    for (let i = 0; i < 2; i++) {
      regularPlayers.push({
        name: getRandomName(),
        position: 'goalie' as const,
        is_regular: 1,
        offense_weight: getRandomRating(2, 4),
        defense_weight: getRandomRating(5, 8),
        defense_rating: getRandomRating(5, 9),
        forward_rating: getRandomRating(2, 5),
        goalie_rating: getRandomRating(7, 10),
      });
    }

    // Create subs: 3 forwards, 2 defensemen, 1 goalie
    const subPlayers = [];

  // 3 Forward subs
  for (let i = 0; i < 3; i++) {
    const fwdPos = i === 0 ? '["center","winger"]' : i === 1 ? '["center"]' : '["winger"]';
    subPlayers.push({
      name: getRandomName(),
      position: 'forward' as const,
      forward_positions: fwdPos,
      is_regular: 0,
      offense_weight: getRandomRating(5, 9),
      defense_weight: getRandomRating(3, 7),
      defense_rating: getRandomRating(3, 6),
      forward_rating: getRandomRating(5, 9),
      goalie_rating: getRandomRating(2, 3),
    });
  }

    // 2 Defense subs
    for (let i = 0; i < 2; i++) {
      subPlayers.push({
        name: getRandomName(),
        position: 'defense' as const,
        is_regular: 0,
        offense_weight: getRandomRating(3, 6),
        defense_weight: getRandomRating(5, 9),
        defense_rating: getRandomRating(5, 9),
        forward_rating: getRandomRating(3, 7),
        goalie_rating: getRandomRating(2, 3),
      });
    }

    // 1 Goalie sub
    subPlayers.push({
      name: getRandomName(),
      position: 'goalie' as const,
      is_regular: 0,
      offense_weight: getRandomRating(2, 3),
      defense_weight: getRandomRating(4, 7),
      defense_rating: getRandomRating(4, 7),
      forward_rating: getRandomRating(2, 4),
      goalie_rating: getRandomRating(6, 9),
    });

    const allPlayers = [...regularPlayers, ...subPlayers];

    // Insert all players
    for (const player of allPlayers) {
    const result = await runAsync(
      `INSERT INTO players
      (league_id, name, position, forward_positions, email, is_regular, offense_weight, defense_weight, defense_rating, forward_rating, goalie_rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testLeagueId,
        player.name,
        player.position,
        player.forward_positions || null,
        getRandomEmail(player.name),
        player.is_regular,
        player.offense_weight,
        player.defense_weight,
        player.defense_rating,
        player.forward_rating,
        player.goalie_rating,
      ]
      );

      await runAsync('INSERT INTO player_leagues (player_id, league_id) VALUES (?, ?)', [
        result.lastID,
        testLeagueId,
      ]);
    }

    console.log(`Test data seeded: ${allPlayers.length} players created (22 regulars: 12F+8D+2G + 6 subs)`);
  } catch (error) {
    console.error('Error seeding test data:', error);
  }
}

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Leagues table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create a default league for first-run and migrations
    let defaultLeague = await getAsync('SELECT id FROM leagues ORDER BY id LIMIT 1') as { id: number } | undefined;
    if (!defaultLeague) {
      const result = await runAsync('INSERT INTO leagues (name) VALUES (?)', ['Main League']);
      defaultLeague = { id: result.lastID };
      console.log('Default league created (Main League)');
    }

    // Users table (for authentication)
    await runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        league_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User-league access table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS user_leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        league_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
        UNIQUE(user_id, league_id)
      )
    `);

    // Players table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER,
        user_id INTEGER,
        name TEXT NOT NULL,
        position TEXT DEFAULT 'forward',
        email TEXT,
        phone TEXT,
        is_regular INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
  forward_positions TEXT,
  offense_weight INTEGER DEFAULT 5,
  defense_weight INTEGER DEFAULT 5,
  defense_rating INTEGER DEFAULT 5,
  forward_rating INTEGER DEFAULT 5,
  goalie_rating INTEGER DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
  )
    `);

    // Player-league membership table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS player_leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        league_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
        UNIQUE(player_id, league_id)
      )
    `);

    // Series table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER,
        name TEXT NOT NULL,
        best_of INTEGER DEFAULT 1,
        team1_wins INTEGER DEFAULT 0,
        team2_wins INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (league_id) REFERENCES leagues(id)
      )
    `);

    // Games table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER,
        series_id INTEGER,
        date DATE NOT NULL,
        time TEXT,
        location TEXT,
        status TEXT DEFAULT 'scheduled',
        team1_score INTEGER,
        team2_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (league_id) REFERENCES leagues(id),
        FOREIGN KEY (series_id) REFERENCES series(id)
      )
    `);

    // Teams table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        series_id INTEGER,
        team_number INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(game_id, player_id),
        UNIQUE(series_id, player_id)
      )
    `);

    // Player invite codes for onboarding
    await runAsync(`
      CREATE TABLE IF NOT EXISTS player_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        league_id INTEGER NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        created_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Notification delivery log
    await runAsync(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        trigger_type TEXT NOT NULL,
        absent_player_id INTEGER,
        recipient_player_id INTEGER,
        recipient_name TEXT,
        email TEXT,
        phone TEXT,
        status TEXT NOT NULL,
        channels_sent TEXT,
        provider TEXT,
        reason TEXT,
        initiated_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (absent_player_id) REFERENCES players(id) ON DELETE SET NULL,
        FOREIGN KEY (recipient_player_id) REFERENCES players(id) ON DELETE SET NULL,
        FOREIGN KEY (initiated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Migrate older databases that were created before league support existed
    if (!(await columnExists('users', 'league_id'))) {
      await runAsync('ALTER TABLE users ADD COLUMN league_id INTEGER REFERENCES leagues(id)');
    }

    if (!(await columnExists('players', 'league_id'))) {
      await runAsync('ALTER TABLE players ADD COLUMN league_id INTEGER REFERENCES leagues(id)');
    }

    if (!(await columnExists('players', 'position'))) {
      await runAsync("ALTER TABLE players ADD COLUMN position TEXT DEFAULT 'forward'");
    }

    if (!(await columnExists('players', 'offense_weight'))) {
      await runAsync('ALTER TABLE players ADD COLUMN offense_weight INTEGER DEFAULT 5');
    }

    if (!(await columnExists('players', 'defense_weight'))) {
      await runAsync('ALTER TABLE players ADD COLUMN defense_weight INTEGER DEFAULT 5');
    }

    if (!(await columnExists('players', 'defense_rating'))) {
      await runAsync('ALTER TABLE players ADD COLUMN defense_rating INTEGER DEFAULT 5');
    }

    if (!(await columnExists('players', 'forward_rating'))) {
      await runAsync('ALTER TABLE players ADD COLUMN forward_rating INTEGER DEFAULT 5');
    }

  if (!(await columnExists('players', 'goalie_rating'))) {
    await runAsync('ALTER TABLE players ADD COLUMN goalie_rating INTEGER DEFAULT 5');
  }

  if (!(await columnExists('players', 'forward_positions'))) {
    await runAsync("ALTER TABLE players ADD COLUMN forward_positions TEXT");
    await runAsync("UPDATE players SET forward_positions = '[\"center\",\"winger\"]' WHERE position = 'forward'");
  }

    if (!(await columnExists('games', 'league_id'))) {
      await runAsync('ALTER TABLE games ADD COLUMN league_id INTEGER REFERENCES leagues(id)');
    }

    if (!(await columnExists('games', 'series_id'))) {
      await runAsync('ALTER TABLE games ADD COLUMN series_id INTEGER');
    }

    if (!(await columnExists('teams', 'series_id'))) {
      await runAsync('ALTER TABLE teams ADD COLUMN series_id INTEGER');
    }

    if (!(await columnExists('teams', 'team_name'))) {
      await runAsync("ALTER TABLE teams ADD COLUMN team_name TEXT");
    }

    // Backfill existing rows into the default league
    await runAsync('UPDATE users SET league_id = ? WHERE league_id IS NULL', [defaultLeague.id]);
    await runAsync('UPDATE players SET league_id = ? WHERE league_id IS NULL', [defaultLeague.id]);
    await runAsync('UPDATE games SET league_id = ? WHERE league_id IS NULL', [defaultLeague.id]);
    await runAsync("UPDATE players SET position = 'forward' WHERE position IS NULL");
    await runAsync('UPDATE players SET offense_weight = 5 WHERE offense_weight IS NULL');
    await runAsync('UPDATE players SET defense_weight = 5 WHERE defense_weight IS NULL');
    await runAsync('UPDATE players SET defense_rating = 5 WHERE defense_rating IS NULL');
    await runAsync('UPDATE players SET forward_rating = 5 WHERE forward_rating IS NULL');
    await runAsync('UPDATE players SET goalie_rating = 5 WHERE goalie_rating IS NULL');

    await runAsync('CREATE INDEX IF NOT EXISTS idx_users_league_id ON users(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_players_league_id ON players(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_games_league_id ON games(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_player_leagues_player_id ON player_leagues(player_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_player_leagues_league_id ON player_leagues(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_user_leagues_user_id ON user_leagues(user_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_user_leagues_league_id ON user_leagues(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_player_invites_player_id ON player_invites(player_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_player_invites_league_id ON player_invites(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_player_invites_invite_code ON player_invites(invite_code)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_notification_logs_game_id ON notification_logs(game_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_player_id ON notification_logs(recipient_player_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_games_series_id ON games(series_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_teams_series_id ON teams(series_id)');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_series_league_id ON series(league_id)');

  // Backfill player-league memberships from legacy players.league_id.
    await runAsync(`
      INSERT OR IGNORE INTO player_leagues (player_id, league_id)
      SELECT id, league_id FROM players WHERE league_id IS NOT NULL
    `);

    // Ensure each user has at least one explicit league access entry.
    await runAsync(`
      INSERT OR IGNORE INTO user_leagues (user_id, league_id)
      SELECT id, league_id FROM users WHERE league_id IS NOT NULL
    `);

    // Attendance table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        responded_at DATETIME,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(game_id, player_id)
      )
    `);

    // League-specific player ratings table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS player_league_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    position TEXT,
    forward_positions TEXT,
    offense_weight INTEGER,
    defense_weight INTEGER,
    defense_rating INTEGER,
    forward_rating INTEGER,
    goalie_rating INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    UNIQUE(player_id, league_id)
  )
  `);

  if (!(await columnExists('player_league_ratings', 'forward_positions'))) {
    await runAsync('ALTER TABLE player_league_ratings ADD COLUMN forward_positions TEXT');
  }

  // Create default admin user if not exists
    const adminExists = await getAsync('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      const adminResult = await runAsync(
        'INSERT INTO users (username, password, is_admin, league_id) VALUES (?, ?, 1, ?)',
        ['admin', hashedPassword, defaultLeague.id]
      );
      await runAsync('INSERT OR IGNORE INTO user_leagues (user_id, league_id) VALUES (?, ?)', [
        adminResult.lastID,
        defaultLeague.id,
      ]);
      console.log('Default admin user created (username: admin, password: admin123)');
    }

    // Seed test data if enabled via environment variable
    if (process.env.SEED_TEST_DATA === 'true') {
      await seedTestData();
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

export { runAsync, getAsync, allAsync };
export default db;
