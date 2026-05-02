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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { authApi, playersApi } from '../services/api';
import { Player } from '../types';
import { Navigation } from '../components/Navigation';

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openAddExistingDialog, setOpenAddExistingDialog] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [invitePlayerName, setInvitePlayerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [existingSearch, setExistingSearch] = useState('');
  const [existingError, setExistingError] = useState('');
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    position: 'forward' as 'forward' | 'defense' | 'goalie',
    email: '',
    phone: '',
    is_regular: true,
    offense_weight: 5,
    defense_weight: 5,
    defense_rating: 5,
    forward_rating: 5,
    goalie_rating: 5,
  });
  const [editRatings, setEditRatings] = useState({
    position: 'forward' as 'forward' | 'defense' | 'goalie',
    offense_weight: 5,
    defense_weight: 5,
    defense_rating: 5,
    forward_rating: 5,
    goalie_rating: 5,
  });
  const { user } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    loadPlayers();
  }, [user?.leagueId]);

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
        position: 'forward',
        email: '',
        phone: '',
        is_regular: true,
        offense_weight: 5,
        defense_weight: 5,
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
      position: player.position,
      offense_weight: player.offense_weight,
      defense_weight: player.defense_weight,
    });
    setOpenEditDialog(true);
  };

  const loadAvailableExistingPlayers = async (query: string) => {
    try {
      const response = await playersApi.getAvailableToAdd(query);
      setExistingPlayers(response.data);
      setExistingError('');
    } catch (error) {
      console.error('Failed to load existing players:', error);
      setExistingError(t('players.failedExistingLoad'));
    }
  };

  const handleOpenAddExisting = async () => {
    setOpenAddExistingDialog(true);
    setExistingSearch('');
    await loadAvailableExistingPlayers('');
  };

  const handleAddExistingToLeague = async (playerId: number) => {
    try {
      await playersApi.addToCurrentLeague(playerId);
      await loadPlayers();
      await loadAvailableExistingPlayers(existingSearch);
    } catch (error) {
      console.error('Failed to add existing player:', error);
      setExistingError(t('players.failedAddExisting'));
    }
  };

  const handleCreateInvite = async (player: Player) => {
    try {
      const response = await authApi.invitePlayer(player.id);
      setInvitePlayerName(player.name);
      setInviteCode(response.data.inviteCode || '');
      setInviteCopied(false);
      setOpenInviteDialog(true);
    } catch (error) {
      console.error('Failed to create invite code:', error);
      setExistingError(t('players.failedInvite'));
    }
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  const clampRating = (value: number) => Math.max(0, Math.min(10, value));

  const handleSaveRatings = async () => {
    if (!editingPlayer) {
      return;
    }

    try {
      await playersApi.update(editingPlayer.id, {
        name: editingPlayer.name,
        position: editRatings.position,
        email: editingPlayer.email,
        phone: editingPlayer.phone,
        is_regular: Boolean(editingPlayer.is_regular),
        is_active: Boolean(editingPlayer.is_active),
        defense_rating: clampRating(editRatings.defense_rating),
        forward_rating: clampRating(editRatings.forward_rating),
        goalie_rating: clampRating(editRatings.goalie_rating),
        offense_weight: clampRating(editRatings.offense_weight),
        defense_weight: clampRating(editRatings.defense_weight),
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
          <Typography variant="h4">{t('players.title')}</Typography>
          {user?.isAdmin && (
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                onClick={handleOpenAddExisting}
              >
                {t('players.addExisting')}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                {t('players.add')}
              </Button>
            </Box>
          )}
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('players.name')}</TableCell>
                <TableCell>{t('players.email')}</TableCell>
                <TableCell>{t('players.phone')}</TableCell>
                <TableCell>{t('players.type')}</TableCell>
                <TableCell>{t('players.position')}</TableCell>
                <TableCell>{t('players.offenseWeight')}</TableCell>
                <TableCell>{t('players.defenseWeight')}</TableCell>
                <TableCell>{t('players.defenseRating')}</TableCell>
                <TableCell>{t('players.forwardRating')}</TableCell>
                <TableCell>{t('players.goalieRating')}</TableCell>
                {user?.isAdmin && <TableCell align="right">{t('players.actions')}</TableCell>}
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
                      label={player.is_regular ? t('players.regular') : t('players.sub')}
                      color={player.is_regular ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {player.position === 'forward' && t('players.forward')}
                    {player.position === 'defense' && t('players.defense')}
                    {player.position === 'goalie' && t('players.goalie')}
                  </TableCell>
                  <TableCell>{player.offense_weight}</TableCell>
                  <TableCell>{player.defense_weight}</TableCell>
                  <TableCell>{player.defense_rating}</TableCell>
                  <TableCell>{player.forward_rating}</TableCell>
                  <TableCell>{player.goalie_rating}</TableCell>
                  {user?.isAdmin && (
                    <TableCell align="right">
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleCreateInvite(player)}
                        disabled={Boolean(player.user_id)}
                      >
                        {t('players.createInvite')}
                      </Button>
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
          <DialogTitle>{t('players.addTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label={t('players.name')}
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel id="new-player-position-label">{t('players.position')}</InputLabel>
              <Select
                labelId="new-player-position-label"
                label={t('players.position')}
                value={newPlayer.position}
                onChange={(e) =>
                  setNewPlayer({
                    ...newPlayer,
                    position: e.target.value as 'forward' | 'defense' | 'goalie',
                  })
                }
              >
                <MenuItem value="forward">{t('players.forward')}</MenuItem>
                <MenuItem value="defense">{t('players.defense')}</MenuItem>
                <MenuItem value="goalie">{t('players.goalie')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label={t('players.email')}
              type="email"
              value={newPlayer.email}
              onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label={t('players.phone')}
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
              label={t('players.regularToggle')}
            />
            <TextField
              fullWidth
              label={`${t('players.offenseWeight')} (0-10)`}
              type="number"
              value={newPlayer.offense_weight}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, offense_weight: clampRating(Number(e.target.value)) })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label={`${t('players.defenseWeight')} (0-10)`}
              type="number"
              value={newPlayer.defense_weight}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, defense_weight: clampRating(Number(e.target.value)) })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label={`${t('players.defenseRating')} (0-10)`}
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
              label={`${t('players.forwardRating')} (0-10)`}
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
              label={`${t('players.goalieRating')} (0-10)`}
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
            <Button onClick={() => setOpenDialog(false)}>{t('players.cancel')}</Button>
            <Button onClick={handleCreatePlayer} variant="contained" disabled={!newPlayer.name}>
              {t('players.addPlayer')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('players.updateTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              {editingPlayer?.name}
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel id="edit-player-position-label">{t('players.position')}</InputLabel>
              <Select
                labelId="edit-player-position-label"
                label={t('players.position')}
                value={editRatings.position}
                onChange={(e) =>
                  setEditRatings({
                    ...editRatings,
                    position: e.target.value as 'forward' | 'defense' | 'goalie',
                  })
                }
              >
                <MenuItem value="forward">{t('players.forward')}</MenuItem>
                <MenuItem value="defense">{t('players.defense')}</MenuItem>
                <MenuItem value="goalie">{t('players.goalie')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label={`${t('players.offenseWeight')} (0-10)`}
              type="number"
              value={editRatings.offense_weight}
              onChange={(e) =>
                setEditRatings({
                  ...editRatings,
                  offense_weight: clampRating(Number(e.target.value)),
                })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label={`${t('players.defenseWeight')} (0-10)`}
              type="number"
              value={editRatings.defense_weight}
              onChange={(e) =>
                setEditRatings({
                  ...editRatings,
                  defense_weight: clampRating(Number(e.target.value)),
                })
              }
              margin="normal"
              inputProps={{ min: 0, max: 10 }}
            />
            <TextField
              fullWidth
              label={`${t('players.defenseRating')} (0-10)`}
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
              label={`${t('players.forwardRating')} (0-10)`}
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
              label={`${t('players.goalieRating')} (0-10)`}
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
            <Button onClick={() => setOpenEditDialog(false)}>{t('players.cancel')}</Button>
            <Button onClick={handleSaveRatings} variant="contained" disabled={!editingPlayer}>
              {t('players.save')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openAddExistingDialog}
          onClose={() => setOpenAddExistingDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{t('players.addExistingTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label={t('players.searchExisting')}
              value={existingSearch}
              onChange={(e) => setExistingSearch(e.target.value)}
              margin="normal"
            />
            <Box display="flex" justifyContent="flex-end" mb={1}>
              <Button variant="outlined" onClick={() => loadAvailableExistingPlayers(existingSearch)}>
                {t('players.search')}
              </Button>
            </Box>

            {existingError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {existingError}
              </Alert>
            )}

            <List dense>
              {existingPlayers.length === 0 && (
                <ListItem>
                  <ListItemText primary={t('players.noExistingFound')} />
                </ListItem>
              )}

              {existingPlayers.map((player) => (
                <ListItem key={player.id} disableGutters sx={{ gap: 1 }}>
                  <ListItemText
                    primary={player.name}
                    secondary={player.email || player.phone || '-'}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleAddExistingToLeague(player.id)}
                  >
                    {t('players.addToLeague')}
                  </Button>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddExistingDialog(false)}>{t('players.cancel')}</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openInviteDialog} onClose={() => setOpenInviteDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('players.inviteCodeTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('players.inviteFor')}: {invitePlayerName}
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              value={inviteCode}
              InputProps={{ readOnly: true }}
            />
            <Box display="flex" justifyContent="flex-end" mb={1}>
              <Button variant="outlined" size="small" onClick={handleCopyInviteCode}>
                {t('players.copyInviteCode')}
              </Button>
            </Box>
            {inviteCopied && (
              <Alert severity="success" sx={{ mb: 1 }}>
                {t('players.inviteCopied')}
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              {t('players.inviteCopyHint')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenInviteDialog(false)}>{t('players.cancel')}</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
