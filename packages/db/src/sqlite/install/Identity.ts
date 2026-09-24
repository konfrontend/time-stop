import type { Role } from '@app/domain';

/** Who this Install is: stamped on every Change it writes. */
export interface Identity {
  installId: string;
  actorId: string;
  role: Role;
}
