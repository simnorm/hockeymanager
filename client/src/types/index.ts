export interface LeagueAccess {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  leagueId?: number;
  leagues?: LeagueAccess[];
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
  user_id?: number;
  player_name?: string;
  is_regular?: number;
}

export interface ReplacementSuggestion {
  playerId: number;
  name: string;
  isRegular: boolean;
  score: number;
}

export interface ReplacementNotification {
  status: 'sent' | 'skipped' | 'failed';
  recipientName?: string;
  recipientPlayerId?: number;
  channelsSent: Array<'email' | 'sms'>;
  reason?: 'no-candidate' | 'no-contact-method' | 'no-provider-configured' | 'delivery-failed';
  provider?: 'twilio' | 'voipms';
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
  provider?: 'twilio' | 'voipms';
  reason?: 'no-candidate' | 'no-contact-method' | 'no-provider-configured' | 'delivery-failed';
  initiated_by_user_id?: number;
  created_at: string;
}

export interface TestNotificationResponse {
  result: ReplacementNotification;
}

export interface AttendanceUpdateResponse {
  attendance: Attendance;
  replacementSuggestions: ReplacementSuggestion[];
  replacementMessage?: string;
  replacementNotification?: ReplacementNotification;
}

export interface Team {
  team_number: number;
  player_id: number;
  player_name: string;
}

export interface GameWithDetails extends Game {
  attendance?: Attendance[];
  teams?: Team[];
  notificationLogs?: NotificationLog[];
}
