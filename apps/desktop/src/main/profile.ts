import { join } from 'node:path';
import { app } from 'electron';
import { productName } from '../../package.json';

// Storage identity: renaming it strands every installed database. See docs/release.md.
const DATABASE_FILE = 'timestop.sqlite3';

/** Points the user-data directory at this run's profile; call before anything reads it. */
export function selectProfile(): void {
  // Tests point the app at a throwaway profile so they never touch the real database.
  const profileDir = process.env['DESKTOP_PROFILE_DIR'];
  if (profileDir) app.setPath('userData', profileDir);
  // A dev run keeps its own database, so an unreleased migration never reaches the installed app's.
  else if (!app.isPackaged)
    app.setPath('userData', join(app.getPath('appData'), `${productName} Dev`));
}

export const databasePath = (): string => join(app.getPath('userData'), DATABASE_FILE);
