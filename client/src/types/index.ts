export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  leagueId?: number;
}

export interface Player {
  id: number;
  user_id?: number;
  name: string;
  position: 'forward' | 'defense' | 'goalie';
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
  date: string;
  time?: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  team1_score?: number;
  team2_score?: number;
  created_at: string;
}

export interface Attendance {
  id: number;
  game_id: number;
  player_id: number;
  status: 'pending' | 'present' | 'absent';
  responded_at?: string;
  player_name?: string;
  is_regular?: number;
}

export interface ReplacementSuggestion {
  playerId: number;
  name: string;
  isRegular: boolean;
  score: number;
}

export interface AttendanceUpdateResponse {
  attendance: Attendance;
  replacementSuggestions: ReplacementSuggestion[];
  replacementMessage?: string;
}

export interface Team {
  team_number: number;
  player_id: number;
  player_name: string;
}

export interface GameWithDetails extends Game {
  attendance?: Attendance[];
  teams?: Team[];
}
