import { create } from 'zustand';

const useCanvasStore = create((set, get) => ({
  elements: [],
  history: [[]],
  historyStep: 0,
  tool: 'pencil', // 'pencil', 'eraser', 'line', 'arrow', 'rect', 'circle', 'text', 'select'
  
  // Settings for tools
  strokeColor: '#007BFF', // Sagar Blue
  strokeWidth: 2,
  fillColor: 'transparent',
  eraserSize: 10,
  precisionEraserSize: 10,
  canvasBgColor: '#1A1A1A',
  fontSize: 20,
  fontFamily: 'sans-serif',
  
  setTool: (tool) => set({ tool }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFillColor: (fillColor) => set({ fillColor }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  setPrecisionEraserSize: (precisionEraserSize) => set({ precisionEraserSize }),
  setCanvasBgColor: (canvasBgColor) => set({ canvasBgColor }),
  setFontSize: (fontSize) => set({ fontSize }),
  // Collaboration state
  peerId: null,
  connections: [],
  isCollaborating: false,
  lastUpdateRemote: false,
  
  setPeerId: (peerId) => set({ peerId }),
  setCollaborating: (isCollaborating) => set({ isCollaborating }),
  addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
  removeConnection: (peerId) => set((state) => ({ 
    connections: state.connections.filter(c => c.peer !== peerId) 
  })),
  
  setElements: (elements, addToHistory = true, isRemote = false) => {
    set((state) => {
      if (!addToHistory) return { elements, lastUpdateRemote: isRemote };
      
      const newHistory = state.history.slice(0, state.historyStep + 1);
      newHistory.push(elements);
      
      return {
        elements,
        lastUpdateRemote: isRemote,
        history: newHistory,
        historyStep: newHistory.length - 1
      };
    });
  },
  
  undo: () => {
    set((state) => {
      if (state.historyStep === 0) return state;
      const newStep = state.historyStep - 1;
      return {
        historyStep: newStep,
        elements: state.history[newStep]
      };
    });
  },
  
  redo: () => {
    set((state) => {
      if (state.historyStep === state.history.length - 1) return state;
      const newStep = state.historyStep + 1;
      return {
        historyStep: newStep,
        elements: state.history[newStep]
      };
    });
  },
  
  clearStore: () => set({ 
    elements: [], 
    history: [[]], 
    historyStep: 0,
    connections: [],
    isCollaborating: false,
    peerId: null
  })
}));

export default useCanvasStore;
