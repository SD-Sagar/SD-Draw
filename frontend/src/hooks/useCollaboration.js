import { useEffect, useCallback, useRef } from 'react';
import Peer from 'peerjs';
import useCanvasStore from '../store/useCanvasStore';

let globalPeer = null;

const useCollaboration = () => {
  const { 
    elements, setElements, peerId, setPeerId, 
    connections, addConnection, removeConnection,
    isCollaborating, setCollaborating
  } = useCanvasStore();
  
  const elementsRef = useRef(elements);

  // Keep elementsRef in sync for use in callbacks without stale closures
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Broadcast data to all connected peers
  const broadcast = useCallback((data) => {
    connections.forEach(conn => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }, [connections]);

  const handleConnection = useCallback((conn, isIncoming = false) => {
    conn.on('open', () => {
      addConnection(conn);
      
      if (isIncoming) {
        // We are the Host: set collaborating and send our current state to the new guest
        setCollaborating(true);
        conn.send({ type: 'INITIAL_STATE', elements: elementsRef.current });
        console.log('Host: Connected to peer and sent state:', conn.peer);
      } else {
        // We are the Guest: wait for INITIAL_STATE before setting collaborating to true
        console.log('Guest: Connected to peer, waiting for state...', conn.peer);
      }
    });

    conn.on('data', (data) => {
      if (data.type === 'INITIAL_STATE') {
        console.log('Guest: Received initial state from host');
        setElements(data.elements, false, true);
        setCollaborating(true); // Now we can start broadcasting our own changes
      } else if (data.type === 'ELEMENTS_UPDATE') {
        setElements(data.elements, true, true);
      } else if (data.type === 'ELEMENT_ADDED') {
        setElements([...elementsRef.current, data.element], true, true);
      }
    });

    conn.on('close', () => {
      removeConnection(conn.peer);
      console.log('Disconnected from peer:', conn.peer);
      // Only disable collaboration if no connections left
      // We check store state directly or rely on removal
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      removeConnection(conn.peer);
    });
  }, [addConnection, removeConnection, setCollaborating, setElements]);

  const handleConnectionRef = useRef();
  handleConnectionRef.current = handleConnection;

  useEffect(() => {
    if (!globalPeer) {
      globalPeer = new Peer();

      globalPeer.on('open', (id) => {
        setPeerId(id);
        console.log('My peer ID is:', id);
      });

      globalPeer.on('connection', (conn) => {
        if (handleConnectionRef.current) {
          handleConnectionRef.current(conn, true);
        }
      });

      globalPeer.on('error', (err) => {
        console.error('PeerJS error:', err);
      });
    } else {
      if (globalPeer.id) setPeerId(globalPeer.id);
      
      // If we are remounting, we should check if there are still active connections
      // and update the store accordingly (though clearStore usually handles this)
    }
  }, [setPeerId]); // Removed handleConnection from deps as we use Ref

  const joinRoom = useCallback((id) => {
    if (!globalPeer || !id || id === globalPeer.id) return;
    if (connections.some(c => c.peer === id)) return;

    const conn = globalPeer.connect(id);
    handleConnection(conn, false); // Incoming is false for guest
  }, [handleConnection, connections]);

  return { broadcast, joinRoom };
};

export default useCollaboration;
