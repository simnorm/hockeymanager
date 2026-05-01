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

    // Players table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        is_regular INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (league_id) REFERENCES leagues(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Games table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER,
        date DATE NOT NULL,
        time TEXT,
        location TEXT,
        status TEXT DEFAULT 'scheduled',
        team1_score INTEGER,
        team2_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (league_id) REFERENCES leagues(id)
      )
    `);

    // Migrate older databases that were created before league support existed
    if (!(await columnExists('users', 'league_id'))) {
      await runAsync('ALTER TABLE users ADD COLUMN league_id INTEGER REFERENCES leagues(id)');
    }

    if (!(await columnExists('players', 'league_id'))) {
      await runAsync('ALTER TABLE players ADD COLUMN league_id INTEGER REFERENCES leagues(id)');
    }

    if (!(await columnExists('games', 'league_id'))) {
      await runAsync('ALTER TABLE games ADD COLUMN league_id INTEGER REFERENCES leagues(id)');
    }

    // Backfill existing rows into the default league
    await runAsync('UPDATE users SET league_id = ? WHERE league_id IS NULL', [defaultLeague.id]);
    await runAsync('UPDATE players SET league_id = ? WHERE league_id IS NULL', [defaultLeague.id]);
    await runAsync('UPDATE games SET league_id = ? WHERE league_id IS NULL', [defaultLeague.id]);

    await runAsync('CREATE INDEX IF NOT EXISTS idx_users_league_id ON users(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_players_league_id ON players(league_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_games_league_id ON games(league_id)');

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

    // Teams table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        team_number INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(game_id, player_id)
      )
    `);

    // Create default admin user if not exists
    const adminExists = await getAsync('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await runAsync(
        'INSERT INTO users (username, password, is_admin, league_id) VALUES (?, ?, 1, ?)',
        ['admin', hashedPassword, defaultLeague.id]
      );
      console.log('Default admin user created (username: admin, password: admin123)');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

export { runAsync, getAsync, allAsync };
export default db;
