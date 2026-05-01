import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { gamesApi } from '../services/api';
import { Game } from '../types';
import { Navigation } from '../components/Navigation';

export function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newGame, setNewGame] = useState({ date: '', time: '', location: '' });
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const response = await gamesApi.getAll();
      setGames(response.data);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async () => {
    try {
      await gamesApi.create(newGame);
      setOpenDialog(false);
      setNewGame({ date: '', time: '', location: '' });
      loadGames();
    } catch (error) {
      console.error('Failed to create game:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'primary';
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

  return (
    <>
      <Navigation />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">{t('games.title')}</Typography>
          {user?.isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              {t('games.newGame')}
            </Button>
          )}
        </Box>

        <Grid container spacing={3}>
          {games.map((game) => (
            <Grid item xs={12} md={6} key={game.id}>
              <Card
                sx={{ cursor: 'pointer', '&:hover': { boxShadow: 6 } }}
                onClick={() => navigate(`/games/${game.id}`)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      {new Date(game.date).toLocaleDateString()}
                    </Typography>
                    <Chip label={t(`games.status.${game.status}` as 'games.status.scheduled' | 'games.status.completed' | 'games.status.cancelled')} color={getStatusColor(game.status)} size="small" />
                  </Box>
                  
                  {game.time && (
                    <Typography variant="body2" color="text.secondary">
                      {t('games.time')}: {game.time}
                    </Typography>
                  )}
                  
                  {game.location && (
                    <Typography variant="body2" color="text.secondary">
                      {t('games.location')}: {game.location}
                    </Typography>
                  )}
                  
                  {game.status === 'completed' && game.team1_score !== undefined && (
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      {t('games.score')}: {game.team1_score} - {game.team2_score}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {games.length === 0 && (
          <Box textAlign="center" mt={8}>
            <Typography variant="h6" color="text.secondary">
              {t('games.none')}
            </Typography>
          </Box>
        )}

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('games.createTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label={t('games.date')}
              type="date"
              value={newGame.date}
              onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              fullWidth
              label={t('games.time')}
              type="time"
              value={newGame.time}
              onChange={(e) => setNewGame({ ...newGame, time: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label={t('games.location')}
              value={newGame.location}
              onChange={(e) => setNewGame({ ...newGame, location: e.target.value })}
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>{t('games.cancel')}</Button>
            <Button onClick={handleCreateGame} variant="contained" disabled={!newGame.date}>
              {t('games.create')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
