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

  const handleConnection = useCallback((conn) => {
    conn.on('open', () => {
      addConnection(conn);
      setCollaborating(true);
      
      // Host: Send current full state to the new guest
      conn.send({ type: 'INITIAL_STATE', elements: elementsRef.current });
      console.log('Connected to peer:', conn.peer);
    });

    conn.on('data', (data) => {
      if (data.type === 'INITIAL_STATE') {
        setElements(data.elements, false, true);
        setCollaborating(true);
      } else if (data.type === 'ELEMENTS_UPDATE') {
        setElements(data.elements, true, true);
      } else if (data.type === 'ELEMENT_ADDED') {
        setElements([...elementsRef.current, data.element], true, true);
      }
    });

    conn.on('close', () => {
      removeConnection(conn.peer);
      console.log('Disconnected from peer:', conn.peer);
      if (connections.length <= 1) setCollaborating(false);
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      removeConnection(conn.peer);
    });
  }, [addConnection, removeConnection, setCollaborating, setElements, connections.length]);

  useEffect(() => {
    if (!globalPeer) {
      globalPeer = new Peer();

      globalPeer.on('open', (id) => {
        setPeerId(id);
        console.log('My peer ID is:', id);
      });

      globalPeer.on('connection', (conn) => {
        handleConnection(conn);
      });

      globalPeer.on('error', (err) => {
        console.error('PeerJS error:', err);
      });
    } else {
      // If already exists, make sure we have the ID in store
      if (globalPeer.id) setPeerId(globalPeer.id);
    }
  }, [handleConnection, setPeerId]);

  const joinRoom = useCallback((id) => {
    if (!globalPeer || !id || id === globalPeer.id) return;
    // Avoid duplicate connections
    if (connections.some(c => c.peer === id)) return;

    const conn = globalPeer.connect(id);
    handleConnection(conn);
  }, [handleConnection, connections]);

  return { broadcast, joinRoom };
};

export default useCollaboration;
