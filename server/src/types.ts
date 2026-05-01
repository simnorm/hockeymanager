export interface User {
  id: number;
  username: string;
  password: string;
  is_admin: number;
  created_at: string;
}

export interface Player {
  id: number;
  user_id?: number;
  name: string;
  email?: string;
  phone?: string;
  is_regular: number;
  is_active: number;
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
}

export interface Team {
  id: number;
  game_id: number;
  team_number: number;
  player_id: number;
}

export interface GameWithDetails extends Game {
  attendance?: AttendanceWithPlayer[];
  teams?: TeamWithPlayer[];
}

export interface AttendanceWithPlayer extends Attendance {
  player_name: string;
  is_regular: number;
}

export interface TeamWithPlayer {
  team_number: number;
  player_id: number;
  player_name: string;
}
