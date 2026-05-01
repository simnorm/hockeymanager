import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type Language = 'en' | 'fr';

type TranslationKey =
  | 'nav.games'
  | 'nav.players'
  | 'nav.logout'
  | 'nav.admin'
  | 'nav.leagueName'
  | 'lang.english'
  | 'lang.french'
  | 'login.title'
  | 'login.username'
  | 'login.password'
  | 'login.submit'
  | 'login.failed'
  | 'login.defaultAdmin'
  | 'games.title'
  | 'games.newGame'
  | 'games.time'
  | 'games.location'
  | 'games.score'
  | 'games.none'
  | 'games.createTitle'
  | 'games.date'
  | 'games.cancel'
  | 'games.create'
  | 'games.status.scheduled'
  | 'games.status.completed'
  | 'games.status.cancelled'
  | 'players.title'
  | 'players.add'
  | 'players.name'
  | 'players.email'
  | 'players.phone'
  | 'players.type'
  | 'players.position'
  | 'players.offenseWeight'
  | 'players.defenseWeight'
  | 'players.defenseRating'
  | 'players.forwardRating'
  | 'players.goalieRating'
  | 'players.actions'
  | 'players.regular'
  | 'players.sub'
  | 'players.addTitle'
  | 'players.updateTitle'
  | 'players.regularToggle'
  | 'players.forward'
  | 'players.defense'
  | 'players.goalie'
  | 'players.cancel'
  | 'players.save'
  | 'players.addPlayer'
  | 'gameDetail.back'
  | 'gameDetail.titlePrefix'
  | 'gameDetail.time'
  | 'gameDetail.location'
  | 'gameDetail.finalScore'
  | 'gameDetail.recordScore'
  | 'gameDetail.attendance'
  | 'gameDetail.present'
  | 'gameDetail.pending'
  | 'gameDetail.absent'
  | 'gameDetail.markAbsent'
  | 'gameDetail.markPresent'
  | 'gameDetail.teams'
  | 'gameDetail.createTeamsFromRegulars'
  | 'gameDetail.teamsEmpty'
  | 'gameDetail.team1'
  | 'gameDetail.team2'
  | 'gameDetail.scoreDialog'
  | 'gameDetail.team1Score'
  | 'gameDetail.team2Score'
  | 'gameDetail.saveScore'
  | 'gameDetail.gameNotFound'
  | 'gameDetail.failedAttendance'
  | 'gameDetail.failedAutoBalance'
  | 'gameDetail.attendance.present'
  | 'gameDetail.attendance.absent'
  | 'gameDetail.attendance.pending'
  | 'leagues.manage'
  | 'leagues.title'
  | 'leagues.newName'
  | 'leagues.create'
  | 'leagues.rename'
  | 'leagues.save'
  | 'leagues.noLeagues'
  | 'leagues.failedLoad'
  | 'leagues.failedCreate'
  | 'leagues.failedRename';

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    'nav.games': 'Games',
    'nav.players': 'Players',
    'nav.logout': 'Logout',
    'nav.admin': 'Admin',
    'nav.leagueName': 'Hockey League',
    'lang.english': 'English',
    'lang.french': 'French',
    'login.title': 'Hockey League',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.failed': 'Login failed',
    'login.defaultAdmin': 'Default admin: username: admin, password: admin123',
    'games.title': 'Games',
    'games.newGame': 'New Game',
    'games.time': 'Time',
    'games.location': 'Location',
    'games.score': 'Score',
    'games.none': 'No games scheduled yet',
    'games.createTitle': 'Create New Game',
    'games.date': 'Date',
    'games.cancel': 'Cancel',
    'games.create': 'Create',
    'games.status.scheduled': 'scheduled',
    'games.status.completed': 'completed',
    'games.status.cancelled': 'cancelled',
    'players.title': 'Players',
    'players.add': 'Add Player',
    'players.name': 'Name',
    'players.email': 'Email',
    'players.phone': 'Phone',
    'players.type': 'Type',
    'players.position': 'Position',
    'players.offenseWeight': 'Offense Weight',
    'players.defenseWeight': 'Defense Weight',
    'players.defenseRating': 'Defense',
    'players.forwardRating': 'Forward',
    'players.goalieRating': 'Goalie',
    'players.actions': 'Actions',
    'players.regular': 'Regular',
    'players.sub': 'Sub',
    'players.addTitle': 'Add New Player',
    'players.updateTitle': 'Update Player Ratings',
    'players.regularToggle': 'Regular Player',
    'players.forward': 'Forward',
    'players.defense': 'Defense',
    'players.goalie': 'Goalie',
    'players.cancel': 'Cancel',
    'players.save': 'Save Ratings',
    'players.addPlayer': 'Add Player',
    'gameDetail.back': 'Back to Games',
    'gameDetail.titlePrefix': 'Game on',
    'gameDetail.time': 'Time',
    'gameDetail.location': 'Location',
    'gameDetail.finalScore': 'Final Score',
    'gameDetail.recordScore': 'Record Score',
    'gameDetail.attendance': 'Attendance',
    'gameDetail.present': 'Present',
    'gameDetail.pending': 'Pending',
    'gameDetail.absent': 'Absent',
    'gameDetail.markAbsent': 'Mark Absent',
    'gameDetail.markPresent': 'Mark Present',
    'gameDetail.teams': 'Teams',
    'gameDetail.createTeamsFromRegulars': 'Create Teams From Regulars',
    'gameDetail.teamsEmpty': 'Teams not created yet. Use "Create Teams From Regulars" to plan teams before attendance is confirmed.',
    'gameDetail.team1': 'Team 1',
    'gameDetail.team2': 'Team 2',
    'gameDetail.scoreDialog': 'Record Game Score',
    'gameDetail.team1Score': 'Team 1 Score',
    'gameDetail.team2Score': 'Team 2 Score',
    'gameDetail.saveScore': 'Save Score',
    'gameDetail.gameNotFound': 'Game not found',
    'gameDetail.failedAttendance': 'Failed to update attendance',
    'gameDetail.failedAutoBalance': 'Failed to auto-balance teams',
    'gameDetail.attendance.present': 'present',
    'gameDetail.attendance.absent': 'absent',
    'gameDetail.attendance.pending': 'pending',
    'leagues.manage': 'Manage Leagues',
    'leagues.title': 'League Management',
    'leagues.newName': 'League name',
    'leagues.create': 'Create League',
    'leagues.rename': 'Rename League',
    'leagues.save': 'Save',
    'leagues.noLeagues': 'No leagues found',
    'leagues.failedLoad': 'Failed to load leagues',
    'leagues.failedCreate': 'Failed to create league',
    'leagues.failedRename': 'Failed to rename league',
  },
  fr: {
    'nav.games': 'Matchs',
    'nav.players': 'Joueurs',
    'nav.logout': 'Deconnexion',
    'nav.admin': 'Admin',
    'nav.leagueName': 'Ligue de hockey',
    'lang.english': 'Anglais',
    'lang.french': 'Francais',
    'login.title': 'Ligue de hockey',
    'login.username': 'Nom d\'utilisateur',
    'login.password': 'Mot de passe',
    'login.submit': 'Connexion',
    'login.failed': 'Echec de connexion',
    'login.defaultAdmin': 'Admin par defaut : nom d\'utilisateur : admin, mot de passe : admin123',
    'games.title': 'Matchs',
    'games.newGame': 'Nouveau match',
    'games.time': 'Heure',
    'games.location': 'Lieu',
    'games.score': 'Score',
    'games.none': 'Aucun match planifie',
    'games.createTitle': 'Creer un nouveau match',
    'games.date': 'Date',
    'games.cancel': 'Annuler',
    'games.create': 'Creer',
    'games.status.scheduled': 'planifie',
    'games.status.completed': 'termine',
    'games.status.cancelled': 'annule',
    'players.title': 'Joueurs',
    'players.add': 'Ajouter un joueur',
    'players.name': 'Nom',
    'players.email': 'Courriel',
    'players.phone': 'Telephone',
    'players.type': 'Type',
    'players.position': 'Position',
    'players.offenseWeight': 'Poids offensive',
    'players.defenseWeight': 'Poids defensive',
    'players.defenseRating': 'Defense',
    'players.forwardRating': 'Attaque',
    'players.goalieRating': 'Gardien',
    'players.actions': 'Actions',
    'players.regular': 'Regulier',
    'players.sub': 'Remplacant',
    'players.addTitle': 'Ajouter un nouveau joueur',
    'players.updateTitle': 'Mettre a jour les cotes du joueur',
    'players.regularToggle': 'Joueur regulier',
    'players.forward': 'Attaquant',
    'players.defense': 'Defenseur',
    'players.goalie': 'Gardien',
    'players.cancel': 'Annuler',
    'players.save': 'Enregistrer les cotes',
    'players.addPlayer': 'Ajouter le joueur',
    'gameDetail.back': 'Retour aux matchs',
    'gameDetail.titlePrefix': 'Match du',
    'gameDetail.time': 'Heure',
    'gameDetail.location': 'Lieu',
    'gameDetail.finalScore': 'Score final',
    'gameDetail.recordScore': 'Enregistrer le score',
    'gameDetail.attendance': 'Presence',
    'gameDetail.present': 'Presents',
    'gameDetail.pending': 'En attente',
    'gameDetail.absent': 'Absents',
    'gameDetail.markAbsent': 'Marquer absent',
    'gameDetail.markPresent': 'Marquer present',
    'gameDetail.teams': 'Equipes',
    'gameDetail.createTeamsFromRegulars': 'Creer les equipes des reguliers',
    'gameDetail.teamsEmpty': 'Aucune equipe creee. Utilisez "Creer les equipes des reguliers" pour planifier avant la confirmation de presence.',
    'gameDetail.team1': 'Equipe 1',
    'gameDetail.team2': 'Equipe 2',
    'gameDetail.scoreDialog': 'Enregistrer le score du match',
    'gameDetail.team1Score': 'Score equipe 1',
    'gameDetail.team2Score': 'Score equipe 2',
    'gameDetail.saveScore': 'Enregistrer le score',
    'gameDetail.gameNotFound': 'Match introuvable',
    'gameDetail.failedAttendance': 'Echec de mise a jour de la presence',
    'gameDetail.failedAutoBalance': 'Echec de creation automatique des equipes',
    'gameDetail.attendance.present': 'present',
    'gameDetail.attendance.absent': 'absent',
    'gameDetail.attendance.pending': 'en attente',
    'leagues.manage': 'Gerer les ligues',
    'leagues.title': 'Gestion des ligues',
    'leagues.newName': 'Nom de la ligue',
    'leagues.create': 'Creer la ligue',
    'leagues.rename': 'Renommer la ligue',
    'leagues.save': 'Enregistrer',
    'leagues.noLeagues': 'Aucune ligue trouvee',
    'leagues.failedLoad': 'Echec du chargement des ligues',
    'leagues.failedCreate': 'Echec de creation de la ligue',
    'leagues.failedRename': 'Echec du renommage de la ligue',
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const stored = localStorage.getItem('language');
    if (stored === 'en' || stored === 'fr') {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    localStorage.setItem('language', next);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translations[language][key],
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}
