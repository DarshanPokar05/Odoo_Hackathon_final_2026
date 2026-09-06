import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Returns a socket.io client instance authenticated with the stored JWT.
 * The socket connects once and is cleaned up on unmount.
 */
export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('df360_token');
    if (!token) return;

    socketRef.current = io('/', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('[Socket] connect error:', err.message);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return socketRef;
}
