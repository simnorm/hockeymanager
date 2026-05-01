import { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { leaguesApi } from '../services/api';
import { LeagueAccess } from '../types';
import SportsHockeyIcon from '@mui/icons-material/SportsHockey';
import LogoutIcon from '@mui/icons-material/Logout';

export function Navigation() {
  const { user, logout, switchLeague, updateLeagues } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [manageOpen, setManageOpen] = useState(false);
  const [managedLeagues, setManagedLeagues] = useState<LeagueAccess[]>([]);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [renameValues, setRenameValues] = useState<Record<number, string>>({});
  const [manageError, setManageError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: t('nav.games'), path: '/' },
    { label: t('nav.players'), path: '/players' },
  ];

  useEffect(() => {
    const leagues = user?.leagues || [];
    setManagedLeagues(leagues);
    setRenameValues(
      leagues.reduce<Record<number, string>>((acc, league) => {
        acc[league.id] = league.name;
        return acc;
      }, {})
    );
  }, [user?.leagues]);

  if (!user) return null;

  const handleLeagueChange = async (leagueId: number) => {
    if (user.leagueId === leagueId) {
      return;
    }

    try {
      await switchLeague(leagueId);
      navigate('/');
    } catch (error) {
      console.error('Failed to switch league:', error);
    }
  };

  const loadLeagues = async () => {
    const response = await leaguesApi.getAll();
    const leagues = response.data as LeagueAccess[];
    setManagedLeagues(leagues);
    updateLeagues(leagues);
    setRenameValues(
      leagues.reduce<Record<number, string>>((acc, league) => {
        acc[league.id] = league.name;
        return acc;
      }, {})
    );
  };

  const openManageDialog = async () => {
    setManageError('');
    setManageOpen(true);
    try {
      await loadLeagues();
    } catch (error) {
      console.error('Failed to load leagues:', error);
      setManageError(t('leagues.failedLoad'));
    }
  };

  const handleCreateLeague = async () => {
    const name = newLeagueName.trim();
    if (!name) {
      return;
    }

    try {
      setManageError('');
      await leaguesApi.create(name);
      setNewLeagueName('');
      await loadLeagues();
    } catch (error: any) {
      console.error('Failed to create league:', error);
      setManageError(error?.response?.data?.error || t('leagues.failedCreate'));
    }
  };

  const handleRenameLeague = async (leagueId: number) => {
    const name = (renameValues[leagueId] || '').trim();
    if (!name) {
      return;
    }

    try {
      setManageError('');
      await leaguesApi.rename(leagueId, name);
      await loadLeagues();
    } catch (error: any) {
      console.error('Failed to rename league:', error);
      setManageError(error?.response?.data?.error || t('leagues.failedRename'));
    }
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <SportsHockeyIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          {t('nav.leagueName')}
        </Typography>
        
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              onClick={() => navigate(item.path)}
              sx={{
                borderBottom: location.pathname === item.path ? '2px solid white' : 'none',
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        <Typography variant="body2" sx={{ mr: 2 }}>
          {user.username} {user.isAdmin && `(${t('nav.admin')})`}
        </Typography>

        {user.leagues && user.leagues.length > 0 && (
          <FormControl size="small" sx={{ mr: 2, minWidth: 170 }}>
            <Select
              value={String(user.leagueId || user.leagues[0].id)}
              onChange={(event) => handleLeagueChange(Number(event.target.value))}
              sx={{ color: 'white', '.MuiSvgIcon-root': { color: 'white' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
            >
              {user.leagues.map((league) => (
                <MenuItem key={league.id} value={String(league.id)}>
                  {league.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {user.isAdmin && (
          <Button color="inherit" sx={{ mr: 1 }} onClick={openManageDialog}>
            {t('leagues.manage')}
          </Button>
        )}

        <FormControl size="small" sx={{ mr: 2, minWidth: 120 }}>
          <Select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'fr')}
            sx={{ color: 'white', '.MuiSvgIcon-root': { color: 'white' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
          >
            <MenuItem value="en">{t('lang.english')}</MenuItem>
            <MenuItem value="fr">{t('lang.french')}</MenuItem>
          </Select>
        </FormControl>
        
        <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
          {t('nav.logout')}
        </Button>

        <Dialog open={manageOpen} onClose={() => setManageOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('leagues.title')}</DialogTitle>
          <DialogContent>
            <Box display="flex" gap={1} mt={1}>
              <TextField
                label={t('leagues.newName')}
                value={newLeagueName}
                onChange={(event) => setNewLeagueName(event.target.value)}
                fullWidth
              />
              <Button variant="contained" onClick={handleCreateLeague}>
                {t('leagues.create')}
              </Button>
            </Box>

            {manageError && (
              <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                {manageError}
              </Typography>
            )}

            <List dense sx={{ mt: 2 }}>
              {managedLeagues.length === 0 && (
                <ListItem>
                  <ListItemText primary={t('leagues.noLeagues')} />
                </ListItem>
              )}

              {managedLeagues.map((league) => (
                <ListItem key={league.id} disableGutters sx={{ gap: 1, alignItems: 'center' }}>
                  <TextField
                    label={t('leagues.rename')}
                    value={renameValues[league.id] || ''}
                    onChange={(event) =>
                      setRenameValues({
                        ...renameValues,
                        [league.id]: event.target.value,
                      })
                    }
                    fullWidth
                  />
                  <Button variant="outlined" onClick={() => handleRenameLeague(league.id)}>
                    {t('leagues.save')}
                  </Button>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManageOpen(false)}>{t('games.cancel')}</Button>
          </DialogActions>
        </Dialog>
      </Toolbar>
    </AppBar>
  );
}
