/**
 * The team UI's texts of the Team context (BC-Team): logging in, the team members' accounts, one's own password.
 */
export const accountsTexts = {
  login: {
    title: "Anmelden",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    failed: "Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.",
    locked: "Zu viele fehlgeschlagene Versuche. Bitte in 15 Minuten erneut versuchen.",
  },
  accounts: {
    title: "Teammitglieder",
    newTeamMember: "Neues Teammitglied",
    showDeactivated: "Auch deaktivierte Konten anzeigen",
    applyFilter: "Anzeigen",
    deactivatedMark: "Deaktiviert",
    name: "Name",
    username: "Benutzername",
    initialPassword: "Anfangspasswort",
    passwordHint: "Mindestens 10 Zeichen.",
    role: "Rolle",
    create: "Teammitglied anlegen",
    created: (name: string) => `${name} ist angelegt.`,
    backToList: "Zurück zu den Teammitgliedern",
  },
  account: {
    unknown: "Dieses Teammitglied gibt es nicht.",
    state: "Konto",
    active: "aktiv",
    deactivated: "deaktiviert",
    makeTechnician: "Zu Techniker:in machen",
    makeHelper: "Zu Helfer:in machen",
    newPassword: "Neues Passwort",
    resetPassword: "Passwort zurücksetzen",
    deactivate: "Konto deaktivieren",
    activate: "Konto wieder aktivieren",
    lastTechnician:
      "Mindestens ein aktives Konto einer Techniker:in muss bleiben – deshalb lässt sich dieses Konto weder deaktivieren noch zu Helfer:in machen.",
    roleChanged: (name: string) => `Rolle von ${name} geändert.`,
    passwordReset: (name: string) => `Passwort von ${name} neu gesetzt.`,
    accountDeactivated: (name: string) => `Konto von ${name} deaktiviert.`,
    accountActivated: (name: string) => `Konto von ${name} wieder aktiviert.`,
  },
  deactivateAccount: {
    question: (name: string, firstName: string) =>
      `Konto von ${name} deaktivieren? ${firstName} wird sofort abgemeldet.`,
    ownQuestion: "Dein Konto deaktivieren? Du wirst sofort abgemeldet.",
    confirm: "Konto deaktivieren",
    back: "Zurück",
  },
  ownPassword: {
    title: "Passwort ändern",
    current: "Aktuelles Passwort",
    new: "Neues Passwort",
    submit: "Speichern",
    changed: "Passwort geändert.",
  },
  /** Keyed by the kebab-case reason a Team module function rejects a change (ST-005). */
  accountErrors: {
    "not-authorized": "Das dürfen nur Techniker:innen.",
    "not-found": "Dieses Konto gibt es nicht mehr.",
    "name-required": "Bitte einen Namen angeben.",
    "username-invalid": "Benutzername: 3–30 Zeichen, nur Buchstaben, Ziffern, _ und .",
    "username-taken": "Dieser Benutzername ist schon vergeben.",
    "password-too-short": "Das Passwort braucht mindestens 10 Zeichen.",
    "last-technician": "Die letzte aktive Techniker:in muss bleiben – sonst kommt niemand mehr an die Verwaltung.",
    "current-password-wrong": "Das aktuelle Passwort stimmt nicht.",
    "account-deactivated": "Dieses Konto ist deaktiviert.",
  },
} as const;
