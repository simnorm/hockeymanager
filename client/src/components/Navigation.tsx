import { AppBar, Toolbar, Typography, Button, Box, FormControl, Select, MenuItem } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import SportsHockeyIcon from '@mui/icons-material/SportsHockey';
import LogoutIcon from '@mui/icons-material/Logout';

export function Navigation() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: t('nav.games'), path: '/' },
    { label: t('nav.players'), path: '/players' },
  ];

  if (!user) return null;

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
      </Toolbar>
    </AppBar>
  );
}
