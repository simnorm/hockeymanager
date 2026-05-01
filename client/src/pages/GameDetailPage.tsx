import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  CircularProgress,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi, attendanceApi, teamsApi } from '../services/api';
import { GameWithDetails } from '../types';
import { Navigation } from '../components/Navigation';

export function GameDetailPage() {
  const [game, setGame] = useState<GameWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [openScoreDialog, setOpenScoreDialog] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [actionAlert, setActionAlert] = useState<{ severity: 'info' | 'warning' | 'error'; message: string } | null>(null);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadGame();
  }, [id]);

  const loadGame = async () => {
    try {
      const response = await gamesApi.getById(Number(id));
      setGame(response.data);
      if (response.data.team1_score !== undefined) {
        setScores({ team1: response.data.team1_score, team2: response.data.team2_score || 0 });
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendance = async (playerId: number, status: 'present' | 'absent') => {
    try {
      const response = await attendanceApi.update(Number(id), playerId, status);
      const data = response.data;

      if (status === 'absent') {
        if (data.replacementSuggestions.length > 0) {
          const names = data.replacementSuggestions.map((candidate) => candidate.name).join(', ');
          setActionAlert({
            severity: 'info',
            message: `${data.replacementMessage || 'Suggested replacements'} ${names}`,
          });
        } else if (data.replacementMessage) {
          setActionAlert({
            severity: 'warning',
            message: data.replacementMessage,
          });
        }
      } else {
        setActionAlert(null);
      }

      await loadGame();
    } catch (error: any) {
      setActionAlert({
        severity: 'error',
        message: error?.response?.data?.error || 'Failed to update attendance',
      });
      console.error('Failed to update attendance:', error);
    }
  };

  const handleAutoBalance = async () => {
    try {
      await teamsApi.autoBalance(Number(id));
      setActionAlert(null);
      await loadGame();
    } catch (error: any) {
      setActionAlert({
        severity: 'error',
        message: error?.response?.data?.error || 'Failed to auto-balance teams',
      });
      console.error('Failed to auto-balance teams:', error);
    }
  };

  const handleSaveScore = async () => {
    try {
      await gamesApi.update(Number(id), {
        ...game,
        team1_score: scores.team1,
        team2_score: scores.team2,
        status: 'completed',
      });
      setOpenScoreDialog(false);
      loadGame();
    } catch (error) {
      console.error('Failed to save score:', error);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
          <CircularProgress />
        </Box>
      </>
    );
  }

  if (!game) {
    return (
      <>
        <Navigation />
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography>Game not found</Typography>
        </Container>
      </>
    );
  }

  const presentPlayers = game.attendance?.filter((a) => a.status === 'present') || [];
  const absentPlayers = game.attendance?.filter((a) => a.status === 'absent') || [];
  const pendingPlayers = game.attendance?.filter((a) => a.status === 'pending') || [];

  const team1 = game.teams?.filter((t) => t.team_number === 1) || [];
  const team2 = game.teams?.filter((t) => t.team_number === 2) || [];

  return (
    <>
      <Navigation />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Button onClick={() => navigate('/')} sx={{ mb: 2 }}>
          ← Back to Games
        </Button>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4">
              Game on {new Date(game.date).toLocaleDateString()}
            </Typography>
            <Chip label={game.status} color="primary" />
          </Box>
          
          {game.time && <Typography>Time: {game.time}</Typography>}
          {game.location && <Typography>Location: {game.location}</Typography>}
          
          {game.status === 'completed' && game.team1_score !== undefined && (
            <Typography variant="h5" sx={{ mt: 2 }}>
              Final Score: {game.team1_score} - {game.team2_score}
            </Typography>
          )}

          {user?.isAdmin && game.status !== 'completed' && (
            <Box mt={2}>
              <Button variant="contained" onClick={() => setOpenScoreDialog(true)}>
                Record Score
              </Button>
            </Box>
          )}
        </Paper>

        {actionAlert && (
          <Alert severity={actionAlert.severity} sx={{ mb: 3 }}>
            {actionAlert.message}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">Attendance</Typography>
              </Box>

              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Present ({presentPlayers.length})
              </Typography>
              <List dense>
                {presentPlayers.map((att) => (
                  <ListItem key={att.id}>
                    <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                    <ListItemText
                      primary={att.player_name}
                      secondary={att.is_regular ? 'Regular' : 'Sub'}
                    />
                    {user?.isAdmin && (
                      <Button
                        size="small"
                        onClick={() => handleAttendance(att.player_id, 'absent')}
                      >
                        Mark Absent
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>

              {pendingPlayers.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Pending ({pendingPlayers.length})
                  </Typography>
                  <List dense>
                    {pendingPlayers.map((att) => (
                      <ListItem key={att.id}>
                        <ListItemText
                          primary={att.player_name}
                          secondary={att.is_regular ? 'Regular' : 'Sub'}
                        />
                        {user?.isAdmin && (
                          <Box>
                            <Button
                              size="small"
                              color="success"
                              onClick={() => handleAttendance(att.player_id, 'present')}
                            >
                              Present
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleAttendance(att.player_id, 'absent')}
                            >
                              Absent
                            </Button>
                          </Box>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {absentPlayers.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Absent ({absentPlayers.length})
                  </Typography>
                  <List dense>
                    {absentPlayers.map((att) => (
                      <ListItem key={att.id}>
                        <CancelIcon color="error" sx={{ mr: 1 }} />
                        <ListItemText
                          primary={att.player_name}
                          secondary={att.is_regular ? 'Regular' : 'Sub'}
                        />
                        {user?.isAdmin && (
                          <Button
                            size="small"
                            onClick={() => handleAttendance(att.player_id, 'present')}
                          >
                            Mark Present
                          </Button>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5">Teams</Typography>
                {user?.isAdmin && (
                  <Button variant="outlined" size="small" onClick={handleAutoBalance}>
                    Create Teams From Regulars
                  </Button>
                )}
              </Box>

              {team1.length === 0 && team2.length === 0 ? (
                <Alert severity="info">
                  Teams not created yet. Use "Create Teams From Regulars" to plan teams before attendance is confirmed.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="primary">
                      Team 1
                    </Typography>
                    <List dense>
                      {team1.map((player) => (
                        <ListItem key={player.player_id}>
                          <ListItemText primary={player.player_name} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="secondary">
                      Team 2
                    </Typography>
                    <List dense>
                      {team2.map((player) => (
                        <ListItem key={player.player_id}>
                          <ListItemText primary={player.player_name} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Dialog open={openScoreDialog} onClose={() => setOpenScoreDialog(false)}>
          <DialogTitle>Record Game Score</DialogTitle>
          <DialogContent>
            <Box display="flex" gap={2} mt={2}>
              <TextField
                label="Team 1 Score"
                type="number"
                value={scores.team1}
                onChange={(e) => setScores({ ...scores, team1: Number(e.target.value) })}
                fullWidth
              />
              <TextField
                label="Team 2 Score"
                type="number"
                value={scores.team2}
                onChange={(e) => setScores({ ...scores, team2: Number(e.target.value) })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenScoreDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveScore} variant="contained">
              Save Score
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
