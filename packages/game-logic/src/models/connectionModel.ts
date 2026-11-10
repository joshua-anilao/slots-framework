import { StateMachine } from '../core/stateMachine';

/** online ⇄ offline. Offline when a request fails or the device loses its network. */
export type ConnectionState = 'online' | 'offline';

export class ConnectionModel {
  readonly machine = new StateMachine<ConnectionState, 'lost' | 'restored'>('online', {
    online: { lost: 'offline' },
    offline: { restored: 'online' },
  });
}
