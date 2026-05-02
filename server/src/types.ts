export interface League {
  id: number;
  name: string;
  created_at: string;
}

export interface LeagueAccess {
  id: number;
  name: string;
}

export type PlayerPosition = 'forward' | 'defense' | 'goalie';

export type ForwardPosition = 'center' | 'winger';

export interface User {
  id: number;
  username: string;
  password: string;
  is_admin: number;
  league_id: number;
  created_at: string;
}

export interface Player {
  id: number;
  league_id?: number;
  user_id?: number;
  name: string;
  position: PlayerPosition;
  forward_positions?: string;
  email?: string;
  phone?: string;
  is_regular: number;
  is_active: number;
  offense_weight: number;
  defense_weight: number;
  defense_rating: number;
  forward_rating: number;
  goalie_rating: number;
  created_at: string;
}

export interface Game {
  id: number;
  league_id: number;
  date: string;
  time?: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  team1_score?: number;
  team2_score?: number;
  series_id?: number;
  created_at: string;
}

export interface Series {
  id: number;
  league_id: number;
  name: string;
  best_of: number;
  team1_wins: number;
  team2_wins: number;
  created_at: string;
}

export interface Attendance {
  id: number;
  game_id: number;
  player_id: number;
  status: 'pending' | 'present' | 'absent';
  responded_at?: string;
}

export interface Team {
  id: number;
  game_id?: number;
  series_id?: number;
  team_number: number;
  team_name?: string;
  player_id: number;
}

export interface GameWithDetails extends Game {
  attendance?: AttendanceWithPlayer[];
  teams?: TeamWithPlayer[];
  series?: Series;
  notificationLogs?: NotificationLog[];
}

export interface AttendanceWithPlayer extends Attendance {
  user_id?: number;
  player_name: string;
  is_regular: number;
}

export interface TeamWithPlayer {
  team_number: number;
  player_id: number;
  player_name: string;
  position: 'forward' | 'defense' | 'goalie';
  forward_positions?: string;
  team_name?: string;
}

export interface NotificationLog {
  id: number;
  game_id?: number;
  trigger_type: 'absence' | 'test';
  absent_player_id?: number;
  absent_player_name?: string;
  recipient_player_id?: number;
  recipient_name?: string;
  email?: string;
  phone?: string;
  status: 'sent' | 'skipped' | 'failed';
  channels_sent?: string;
  provider?: string;
  reason?: string;
  initiated_by_user_id?: number;
  created_at: string;
}
