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
    newAccount: "Neues Konto",
    name: "Name",
    username: "Benutzername",
    initialPassword: "Anfangspasswort",
    role: "Rolle",
    create: "Konto anlegen",
    created: "Konto angelegt.",
    deactivated: "deaktiviert",
    deactivate: "Deaktivieren",
    makeTechnician: "Zu Techniker:in machen",
    makeHelper: "Zu Helfer:in machen",
    newPassword: "Neues Passwort",
    resetPassword: "Passwort zurücksetzen",
    passwordReset: "Passwort neu gesetzt.",
    roleChanged: "Rolle geändert.",
    accountDeactivated: "Konto deaktiviert.",
    passwordHint: "Mindestens 10 Zeichen.",
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
  },
} as const;
