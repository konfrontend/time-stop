import { method, type } from '@app/domain';

/** A GitHub Release newer than the running app. */
export interface Update {
  version: string;
  url: string;
}

export const release = {
  getVersion: method({ output: type<string>() }),
  // Null when no newer release exists, and whenever the check could not tell.
  checkForUpdate: method({ output: type<Update | null>() }),
};
