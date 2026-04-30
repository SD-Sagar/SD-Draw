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
  setFontFamily: (fontFamily) => set({ fontFamily }),
  
  setElements: (elements, addToHistory = true) => {
    set((state) => {
      if (!addToHistory) return { elements };
      
      const newHistory = state.history.slice(0, state.historyStep + 1);
      newHistory.push(elements);
      return {
        elements,
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
  
  clearStore: () => set({ elements: [], history: [[]], historyStep: 0 })
}));

export default useCanvasStore;
