import axios from 'axios';
import { AttendanceUpdateResponse, TestNotificationResponse } from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  switchLeague: (leagueId: number) =>
    api.post('/auth/switch-league', { leagueId }),
  invitePlayer: (playerId: number) =>
    api.post('/auth/invite-player', { playerId }),
  completeInvite: (inviteCode: string, username: string, password: string) =>
    api.post('/auth/complete-invite', { inviteCode, username, password }),
  register: (username: string, password: string, playerId?: number, leagueId?: number) =>
    api.post('/auth/register', { username, password, playerId, leagueId }),
};

// Players API
export const playersApi = {
  getAll: () => api.get('/players'),
  getById: (id: number) => api.get(`/players/${id}`),
  getAvailableToAdd: (query: string) => api.get('/players/available-to-add', { params: { q: query } }),
  addToCurrentLeague: (id: number) => api.post(`/players/${id}/add-to-current-league`),
  create: (data: any) => api.post('/players', data),
  update: (id: number, data: any) => api.put(`/players/${id}`, data),
  delete: (id: number) => api.delete(`/players/${id}`),
  getLeagueCount: (id: number) => api.get(`/players/${id}/league-count`),
};

// Games API
export const gamesApi = {
  getAll: () => api.get('/games'),
  getById: (id: number) => api.get(`/games/${id}`),
  create: (data: any) => api.post('/games', data),
  update: (id: number, data: any) => api.put(`/games/${id}`, data),
  delete: (id: number) => api.delete(`/games/${id}`),
};

// Attendance API
export const attendanceApi = {
  update: (gameId: number, playerId: number, status: 'present' | 'absent') =>
    api.put<AttendanceUpdateResponse>(`/attendance/${gameId}/${playerId}`, { status }),
};

// Teams API
export const teamsApi = {
  create: (gameId: number, teams: { team1: number[]; team2: number[] }) =>
    api.post(`/teams/${gameId}`, { teams }),
  autoBalance: (gameId: number) => api.post(`/teams/${gameId}/auto-balance`),
  updateTeamNames: (gameId: number, teamNames: { team1Name?: string; team2Name?: string }) =>
    api.put(`/teams/${gameId}/team-names`, teamNames),
};

// Leagues API
export const leaguesApi = {
  getAll: () => api.get('/leagues'),
  create: (name: string) => api.post('/leagues', { name }),
  rename: (leagueId: number, name: string) => api.put(`/leagues/${leagueId}`, { name }),
};

export const seriesApi = {
  getAll: () => api.get('/series'),
  create: (name: string, bestOf: number) => api.post('/series', { name, best_of: bestOf }),
};

export const notificationsApi = {
  sendTest: (data: { recipientName: string; email?: string; phone?: string; gameId?: number }) =>
    api.post<TestNotificationResponse>('/notifications/test', data),
};

export default api;
