import { app } from 'electron';
import { DESKTOP_PREFIX } from '../shared/desktop';
import { release, type Update } from '../shared/release';
import { registerMethods } from './ipc';

/** Hands the renderer the running version and the answer of the launch update check. */
export function registerReleaseIpc(update: Promise<Update | null>): () => void {
  return registerMethods(
    DESKTOP_PREFIX,
    { release },
    {
      release: {
        async getVersion() {
          return app.getVersion();
        },
        checkForUpdate: () => update,
      },
    },
  );
}
