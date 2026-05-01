import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../contexts/AuthContext';
import { playersApi } from '../services/api';
import { Player } from '../types';
import { Navigation } from '../components/Navigation';

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    email: '',
    phone: '',
    is_regular: true,
    defense_rating: 5,
    forward_rating: 5,
    goalie_rating: 5,
  });
  const [editRatings, setEditRatings] = useState({
    defense_rating: 5,
    forward_rating: 5,
    goalie_rating: 5,
  });
  const { user } = useAuth();

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const response = await playersApi.getAll();
      setPlayers(response.data);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayer = async () => {
    try {
      await playersApi.create(newPlayer);
      setOpenDialog(false);
      setNewPlayer({
        name: '',
        email: '',
        phone: '',
        is_regular: true,
        defense_rating: 5,
        forward_rating: 5,
        goalie_rating: 5,
      });
      loadPlayers();
    } catch (error) {
      console.error('Failed to create player:', error);
    }
  };

  const handleOpenEditRatings = (player: Player) => {
    setEditingPlayer(player);
    setEditRatings({
      defense_rating: player.defense_rating,
      forward_rating: player.forward_rating,
      goalie_rating: player.goalie_rating,
    });
    setOpenEditDialog(true);
  };

  const clampRating = (value: number) => Math.max(0, Math.min(10, value));

  const handleSaveRatings = async () => {
    if (!editingPlayer) {
      return;
    }

    try {
      await playersApi.update(editingPlayer.id, {
        name: editingPlayer.name,
        email: editingPlayer.email,
        phone: editingPlayer.phone,
        is_regular: Boolean(editingPlayer.is_regular),
        is_active: Boolean(editingPlayer.is_active),
        defense_rating: clampRating(editRatings.defense_rating),
        forward_rating: clampRating(editRatings.forward_rating),
        goalie_rating: clampRating(editRatings.goalie_rating),
      });

      setOpenEditDialog(false);
      setEditingPlayer(null);
      loadPlayers();
    } catch (error) {
      console.error('Failed to update ratings:', error);
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
          <Typography variant="h4">Players</Typography>
          {user?.isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              Add Player
            </Button>
          )}
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Defense</TableCell>
                <TableCell>Forward</TableCell>
                <TableCell>Goalie</TableCell>
                {user?.isAdmin && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>{player.name}</TableCell>
                  <TableCell>{player.email || '-'}</TableCell>
                  <TableCell>{player.phone || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={player.is_regular ? 'Regular' : 'Sub'}
                      color={player.is_regular ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{player.defense_rating}</TableCell>
                  <TableCell>{player.forward_rating}</TableCell>
                  <TableCell>{player.goalie_rating}</TableCell>
                  {user?.isAdmin && (
                    <TableCell align="right">
                      <IconButton onClick={() => handleOpenEditRatings(player)} size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Player</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Name"
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={newPlayer.email}
              onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Phone"
              value={newPlayer.phone}
              onChange={(e) => setNewPlayer({ ...newPlayer, phone: e.target.value })}
              margin="normal"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newPlayer.is_regular}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, is_regular: e.target.checked })
                  }
                />
              }
              label="Regular Player"
            />
            <TextField
              fullWidth
              label="Defense Rating (0-10)"
              type="number"
              value={newPlayer.defense_rating}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, defense_rating: clampRating(Number(e.target.value)) })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label="Forward Rating (0-10)"
              type="number"
              value={newPlayer.forward_rating}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, forward_rating: clampRating(Number(e.target.value)) })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label="Goalie Rating (0-10)"
              type="number"
              value={newPlayer.goalie_rating}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, goalie_rating: clampRating(Number(e.target.value)) })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePlayer} variant="contained" disabled={!newPlayer.name}>
              Add Player
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Update Player Ratings</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              {editingPlayer?.name}
            </Typography>
            <TextField
              fullWidth
              label="Defense Rating (0-10)"
              type="number"
              value={editRatings.defense_rating}
              onChange={(e) =>
                setEditRatings({
                  ...editRatings,
                  defense_rating: clampRating(Number(e.target.value)),
                })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label="Forward Rating (0-10)"
              type="number"
              value={editRatings.forward_rating}
              onChange={(e) =>
                setEditRatings({
                  ...editRatings,
                  forward_rating: clampRating(Number(e.target.value)),
                })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label="Goalie Rating (0-10)"
              type="number"
              value={editRatings.goalie_rating}
              onChange={(e) =>
                setEditRatings({
                  ...editRatings,
                  goalie_rating: clampRating(Number(e.target.value)),
                })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveRatings} variant="contained" disabled={!editingPlayer}>
              Save Ratings
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
