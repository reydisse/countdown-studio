import { create } from 'zustand';
import { getRoom } from '../adapter/index.js';

const STORAGE_KEY = 'showstack_room';

export const useRoomStore = create((set, get) => ({
  room:    null,   // full room object from server
  joined:  false,  // true after ROOM_JOINED received from WS
  loading: false,

  // Called once on app startup to restore a saved session
  initialize: async () => {
    const code = sessionStorage.getItem(STORAGE_KEY);
    if (!code) return;
    set({ loading: true });
    try {
      // Must go through the adapter so the request hits the API origin,
      // not the static Pages host (which would return the SPA's index.html).
      const room = await getRoom(code);
      set({ room, loading: false });
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      set({ loading: false });
    }
  },

  setRoom: (room) => {
    sessionStorage.setItem(STORAGE_KEY, room.code);
    set({ room });
  },

  // Called by useWebSocket when ROOM_JOINED arrives
  setJoined: (joined) => set({ joined }),

  leaveRoom: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ room: null, joined: false });
  },

  getRoomCode: () => get().room?.code ?? null,
}));
