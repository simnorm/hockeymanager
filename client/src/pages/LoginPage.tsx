import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import SportsHockeyIcon from '@mui/icons-material/SportsHockey';

export function LoginPage() {
  const [isInviteMode, setIsInviteMode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, completeInvite } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isInviteMode) {
        await completeInvite(inviteCode, username, password);
      } else {
        await login(username, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.failed'));
    }
  };

  const toggleMode = () => {
    setIsInviteMode((prev) => !prev);
    setError('');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'en' | 'fr')}
              >
                <MenuItem value="en">{t('lang.english')}</MenuItem>
                <MenuItem value="fr">{t('lang.french')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
            <SportsHockeyIcon sx={{ fontSize: 40, mr: 1 }} color="primary" />
            <Typography variant="h4" component="h1">
              {t('login.title')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {isInviteMode && (
              <TextField
                fullWidth
                label={t('login.inviteCode')}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                margin="normal"
                required
                autoFocus
              />
            )}
            <TextField
              fullWidth
              label={t('login.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              autoFocus={!isInviteMode}
            />
            <TextField
              fullWidth
              label={t('login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3 }}
            >
              {isInviteMode ? t('login.createAccount') : t('login.submit')}
            </Button>
            <Button
              fullWidth
              variant="text"
              sx={{ mt: 1 }}
              onClick={toggleMode}
            >
              {isInviteMode ? t('login.backToLogin') : t('login.joinWithInvite')}
            </Button>
          </form>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            {t('login.defaultAdmin')}
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
