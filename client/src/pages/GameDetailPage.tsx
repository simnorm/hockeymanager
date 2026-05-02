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
import { gamesApi, attendanceApi, notificationsApi, teamsApi } from '../services/api';
import { GameWithDetails, NotificationLog, ReplacementNotification } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { Navigation } from '../components/Navigation';

export function GameDetailPage() {
  const [game, setGame] = useState<GameWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [openScoreDialog, setOpenScoreDialog] = useState(false);
  const [openTestDialog, setOpenTestDialog] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [testRecipientName, setTestRecipientName] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [actionAlert, setActionAlert] = useState<{ severity: 'info' | 'warning' | 'error'; message: string } | null>(null);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const formatNotificationMessage = (notification: ReplacementNotification) => {
    const channels = notification.channelsSent
      .map((channel: 'email' | 'sms') =>
        channel === 'email' ? t('gameDetail.channelEmail') : t('gameDetail.channelSms')
      )
      .join(', ');

    if (notification.status === 'sent' && notification.recipientName) {
      return `${t('gameDetail.notificationSent')} ${notification.recipientName}${channels ? ` (${channels})` : ''}`;
    }

    if (notification.reason === 'no-contact-method' && notification.recipientName) {
      return `${t('gameDetail.notificationNoContact')} ${notification.recipientName}`;
    }

    if (notification.reason === 'no-provider-configured' && notification.recipientName) {
      return `${t('gameDetail.notificationNotConfigured')} ${notification.recipientName}`;
    }

    if (notification.reason === 'no-candidate') {
      return t('gameDetail.notificationNoCandidate');
    }

    if (notification.recipientName) {
      return `${t('gameDetail.notificationFailed')} ${notification.recipientName}`;
    }

    return undefined;
  };

  const formatChannels = (channels: string[] | undefined) => {
    if (!channels || channels.length === 0) {
      return '-';
    }

    return channels
      .map((channel) => (channel === 'email' ? t('gameDetail.channelEmail') : t('gameDetail.channelSms')))
      .join(', ');
  };

  const formatLogReason = (reason?: NotificationLog['reason']) => {
    if (reason === 'no-contact-method') {
      return t('gameDetail.notificationNoContact');
    }

    if (reason === 'no-provider-configured') {
      return t('gameDetail.notificationNotConfigured');
    }

    if (reason === 'no-candidate') {
      return t('gameDetail.notificationNoCandidate');
    }

    if (reason === 'delivery-failed') {
      return t('gameDetail.notificationFailed');
    }

    return '-';
  };

  const formatLogTrigger = (triggerType: NotificationLog['trigger_type']) =>
    triggerType === 'test' ? t('gameDetail.notificationTriggerTest') : t('gameDetail.notificationTriggerAbsence');

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
        const messageParts: string[] = [];
        const notificationMessage = data.replacementNotification
          ? formatNotificationMessage(data.replacementNotification)
          : undefined;

        if (data.replacementSuggestions.length > 0) {
          const names = data.replacementSuggestions.map((candidate) => candidate.name).join(', ');
          messageParts.push(`${t('gameDetail.suggestedReplacements')} ${names}`);
        } else if (data.replacementMessage) {
          messageParts.push(data.replacementMessage);
        }

        if (notificationMessage) {
          messageParts.push(notificationMessage);
        }

        if (messageParts.length > 0) {
          const severity = data.replacementNotification?.status === 'failed' || data.replacementNotification?.status === 'skipped'
            ? 'warning'
            : data.replacementSuggestions.length > 0
              ? 'info'
              : 'warning';

          setActionAlert({
            severity,
            message: messageParts.join(' '),
          });
        } else {
          setActionAlert(null);
        }
      } else {
        setActionAlert(null);
      }

      await loadGame();
    } catch (error: any) {
      setActionAlert({
        severity: 'error',
        message: error?.response?.data?.error || t('gameDetail.failedAttendance'),
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
        message: error?.response?.data?.error || t('gameDetail.failedAutoBalance'),
      });
      console.error('Failed to auto-balance teams:', error);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      const response = await notificationsApi.sendTest({
        recipientName: testRecipientName,
        email: testEmail || undefined,
        phone: testPhone || undefined,
        gameId: Number(id),
      });

      const notificationMessage = formatNotificationMessage(response.data.result);
      setActionAlert({
        severity: response.data.result.status === 'sent' ? 'info' : 'warning',
        message: notificationMessage || t('gameDetail.notificationTestSuccess'),
      });
      setOpenTestDialog(false);
      setTestRecipientName('');
      setTestEmail('');
      setTestPhone('');
      await loadGame();
    } catch (error: any) {
      setActionAlert({
        severity: 'error',
        message: error?.response?.data?.error || t('gameDetail.failedTestNotification'),
      });
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
          <Typography>{t('gameDetail.gameNotFound')}</Typography>
        </Container>
      </>
    );
  }

  const presentPlayers = game.attendance?.filter((a) => a.status === 'present') || [];
  const absentPlayers = game.attendance?.filter((a) => a.status === 'absent') || [];
  const pendingPlayers = game.attendance?.filter((a) => a.status === 'pending') || [];

  const team1 = game.teams?.filter((t) => t.team_number === 1) || [];
  const team2 = game.teams?.filter((t) => t.team_number === 2) || [];
  const canUpdateAttendance = (attendanceUserId?: number) =>
    Boolean(user && (user.isAdmin || attendanceUserId === user.id));

  return (
    <>
      <Navigation />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Button onClick={() => navigate('/')} sx={{ mb: 2 }}>
          ← {t('gameDetail.back')}
        </Button>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4">
              {t('gameDetail.titlePrefix')} {new Date(game.date).toLocaleDateString()}
            </Typography>
            <Chip
              label={t(`games.status.${game.status}` as 'games.status.scheduled' | 'games.status.completed' | 'games.status.cancelled')}
              color="primary"
            />
          </Box>
          
          {game.time && <Typography>{t('gameDetail.time')}: {game.time}</Typography>}
          {game.location && <Typography>{t('gameDetail.location')}: {game.location}</Typography>}
          
          {game.status === 'completed' && game.team1_score !== undefined && (
            <Typography variant="h5" sx={{ mt: 2 }}>
              {t('gameDetail.finalScore')}: {game.team1_score} - {game.team2_score}
            </Typography>
          )}

          {user?.isAdmin && (
            <Box mt={2} display="flex" gap={1}>
              {game.status !== 'completed' && (
                <Button variant="contained" onClick={() => setOpenScoreDialog(true)}>
                  {t('gameDetail.recordScore')}
                </Button>
              )}
              <Button variant="outlined" onClick={() => setOpenTestDialog(true)}>
                {t('gameDetail.notificationTestButton')}
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
                <Typography variant="h5">{t('gameDetail.attendance')}</Typography>
              </Box>

              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('gameDetail.present')} ({presentPlayers.length})
              </Typography>
              <List dense>
                {presentPlayers.map((att) => (
                  <ListItem key={att.id}>
                    <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                    <ListItemText
                      primary={att.player_name}
                      secondary={att.is_regular ? t('players.regular') : t('players.sub')}
                    />
                    {canUpdateAttendance(att.user_id) && (
                      <Button
                        size="small"
                        onClick={() => handleAttendance(att.player_id, 'absent')}
                      >
                        {t('gameDetail.markAbsent')}
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>

              {pendingPlayers.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t('gameDetail.pending')} ({pendingPlayers.length})
                  </Typography>
                  <List dense>
                    {pendingPlayers.map((att) => (
                      <ListItem key={att.id}>
                        <ListItemText
                          primary={att.player_name}
                          secondary={att.is_regular ? t('players.regular') : t('players.sub')}
                        />
                        {canUpdateAttendance(att.user_id) && (
                          <Box>
                            <Button
                              size="small"
                              color="success"
                              onClick={() => handleAttendance(att.player_id, 'present')}
                            >
                              {t('gameDetail.present')}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleAttendance(att.player_id, 'absent')}
                            >
                              {t('gameDetail.absent')}
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
                    {t('gameDetail.absent')} ({absentPlayers.length})
                  </Typography>
                  <List dense>
                    {absentPlayers.map((att) => (
                      <ListItem key={att.id}>
                        <CancelIcon color="error" sx={{ mr: 1 }} />
                        <ListItemText
                          primary={att.player_name}
                          secondary={att.is_regular ? t('players.regular') : t('players.sub')}
                        />
                        {canUpdateAttendance(att.user_id) && (
                          <Button
                            size="small"
                            onClick={() => handleAttendance(att.player_id, 'present')}
                          >
                            {t('gameDetail.markPresent')}
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
                <Typography variant="h5">{t('gameDetail.teams')}</Typography>
                {user?.isAdmin && (
                  <Button variant="outlined" size="small" onClick={handleAutoBalance}>
                    {t('gameDetail.createTeamsFromRegulars')}
                  </Button>
                )}
              </Box>

              {team1.length === 0 && team2.length === 0 ? (
                <Alert severity="info">
                  {t('gameDetail.teamsEmpty')}
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="primary">
                      {t('gameDetail.team1')}
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
                      {t('gameDetail.team2')}
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

        {user?.isAdmin && (
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              {t('gameDetail.notificationLogs')}
            </Typography>
            <List dense>
              {(game.notificationLogs || []).length === 0 && (
                <ListItem>
                  <ListItemText primary={t('gameDetail.noNotificationLogs')} />
                </ListItem>
              )}
              {(game.notificationLogs || []).map((log) => {
                const channels = log.channels_sent ? log.channels_sent.split(',').filter(Boolean) : [];
                const secondary = [
                  `${t('gameDetail.notificationStatus')}: ${log.status}`,
                  `${t('gameDetail.notificationRecipient')}: ${log.recipient_name || '-'}`,
                  `${t('gameDetail.notificationReason')}: ${formatLogReason(log.reason)}`,
                  `${t('gameDetail.notificationProvider')}: ${log.provider || '-'}`,
                  `${t('gameDetail.notificationChannels')}: ${formatChannels(channels)}`,
                  `${t('gameDetail.notificationSentAt')}: ${new Date(log.created_at).toLocaleString()}`,
                ].join(' | ');

                return (
                  <ListItem key={log.id}>
                    <ListItemText
                      primary={`${formatLogTrigger(log.trigger_type)}${log.absent_player_name ? `: ${log.absent_player_name}` : ''}`}
                      secondary={secondary}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        )}

        <Dialog open={openScoreDialog} onClose={() => setOpenScoreDialog(false)}>
          <DialogTitle>{t('gameDetail.scoreDialog')}</DialogTitle>
          <DialogContent>
            <Box display="flex" gap={2} mt={2}>
              <TextField
                label={t('gameDetail.team1Score')}
                type="number"
                value={scores.team1}
                onChange={(e) => setScores({ ...scores, team1: Number(e.target.value) })}
                fullWidth
              />
              <TextField
                label={t('gameDetail.team2Score')}
                type="number"
                value={scores.team2}
                onChange={(e) => setScores({ ...scores, team2: Number(e.target.value) })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenScoreDialog(false)}>{t('games.cancel')}</Button>
            <Button onClick={handleSaveScore} variant="contained">
              {t('gameDetail.saveScore')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openTestDialog} onClose={() => setOpenTestDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('gameDetail.notificationTestTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              label={t('gameDetail.notificationTestName')}
              value={testRecipientName}
              onChange={(e) => setTestRecipientName(e.target.value)}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('gameDetail.notificationTestEmail')}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('gameDetail.notificationTestPhone')}
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTestDialog(false)}>{t('games.cancel')}</Button>
            <Button
              onClick={handleSendTestNotification}
              variant="contained"
              disabled={!testRecipientName || (!testEmail && !testPhone)}
            >
              {t('gameDetail.notificationTestSend')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
