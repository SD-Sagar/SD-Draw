import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  MousePointer2, Pencil, Eraser, Minus, ArrowRight, 
  Square, Circle, Type, Undo2, Redo2, Download, Save, FolderOpen, PenTool, LogOut, Plus, MinusIcon,
  Triangle, Star
} from 'lucide-react';
import useCanvasStore from '../store/useCanvasStore';
import Logo from './Logo';
import './Toolbox.css';

const Toolbox = () => {
  const { 
    tool, setTool, undo, redo, strokeColor, setStrokeColor, 
    elements, setElements, clearStore, eraserSize, setEraserSize,
    strokeWidth, setStrokeWidth, fontSize, setFontSize,
    fontFamily, setFontFamily, canvasBgColor, setCanvasBgColor,
    selectedId
  } = useCanvasStore();
  const navigate = useNavigate();

  // Helper to update selected element properties
  const updateSelectedElement = (updates) => {
    if (selectedId) {
      const updatedElements = elements.map(el => 
        el.id === selectedId ? { ...el, ...updates } : el
      );
      setElements(updatedElements, true);
    }
  };

  const handleStrokeWidthChange = (val) => {
    setStrokeWidth(val);
    updateSelectedElement({ strokeWidth: val });
  };

  const handleFontSizeChange = (val) => {
    setFontSize(val);
    updateSelectedElement({ fontSize: val });
  };

  const handleFontFamilyChange = (val) => {
    setFontFamily(val);
    updateSelectedElement({ fontFamily: val });
  };

  const handleStrokeColorChange = (val) => {
    setStrokeColor(val);
    const selectedEl = elements.find(el => el.id === selectedId);
    if (selectedEl && selectedEl.type === 'text') {
      updateSelectedElement({ stroke: val, fill: val });
    } else {
      updateSelectedElement({ stroke: val });
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('sd_token');
      await axios.put(`/api/canvas`, { elements }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Canvas saved successfully!');
    } catch (e) {
      alert('Error saving canvas. Make sure you are logged in.');
    }
  };

  const handleLoad = async () => {
    try {
      const token = localStorage.getItem('sd_token');
      const res = await axios.get(`/api/canvas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setElements(res.data, false);
      alert('Canvas loaded successfully!');
    } catch (e) {
      if (e.response && e.response.status === 404) {
        alert('No saved canvas found.');
      } else {
        alert('Error loading canvas. Make sure you are logged in.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_user');
    clearStore();
    navigate('/');
  };

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'pencil', icon: Pencil, label: 'Pencil' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'triangle', icon: Triangle, label: 'Triangle' },
    { id: 'star', icon: Star, label: 'Star' },
    { id: 'text', icon: Type, label: 'Text' },
  ];

  const fonts = [
    { name: 'Sans-serif', value: 'sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: 'Cursive', value: 'cursive' },
    { name: 'Impact', value: 'Impact' },
  ];

  // Determine which settings to show in the floating popup
  const showStrokeSettings = ['pencil', 'line', 'arrow', 'rect', 'circle', 'triangle', 'star'].includes(tool);
  const showTextSettings = tool === 'text';

  return (
  <>
    <div className="toolbox-container">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', animation: 'pulse 2s infinite ease-in-out' }} title="SD-Draw">
        <Logo size={40} />
      </div>
      <div className="toolbox-divider"></div>

      <div className="toolbox-header">Tools</div>
      <div className="tools-grid">
        {tools.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            <t.icon size={18} />
          </button>
        ))}
      </div>

      <div className="toolbox-divider"></div>

      <div className="settings-section">
        <div className="color-item">
          <label>Stroke</label>
          <input 
            type="color" 
            value={strokeColor} 
            onChange={(e) => handleStrokeColorChange(e.target.value)}
            className="color-picker"
          />
        </div>
        <div className="color-item">
          <label>Canvas</label>
          <input 
            type="color" 
            value={canvasBgColor} 
            onChange={(e) => setCanvasBgColor(e.target.value)}
            className="color-picker"
          />
        </div>
      </div>

      <div className="toolbox-divider"></div>

      <div className="actions-grid">
        <button className="action-btn" onClick={undo} title="Undo">
          <Undo2 size={18} />
        </button>
        <button className="action-btn" onClick={redo} title="Redo">
          <Redo2 size={18} />
        </button>
        <button className="action-btn" title="Save" onClick={handleSave}>
          <Save size={18} />
        </button>
        <button className="action-btn" title="Load" onClick={handleLoad}>
          <FolderOpen size={18} />
        </button>
        <button className="action-btn" title="Export to PNG" onClick={() => window.dispatchEvent(new CustomEvent('export-canvas'))} style={{ gridColumn: 'span 2' }}>
          <Download size={18} />
        </button>
        <button className="action-btn" title="Logout" onClick={handleLogout} style={{ gridColumn: 'span 2', color: '#ff4d4d' }}>
          <LogOut size={18} />
        </button>
      </div>
    </div>

    {/* Floating Settings Popup */}
    {(showStrokeSettings || showTextSettings) && (
      <div className="tool-settings-popup">
        {showStrokeSettings && (
          <div className="settings-group">
            <label>Stroke Width: {strokeWidth}</label>
            <div className="settings-controls">
              <button className="mini-btn" onClick={() => handleStrokeWidthChange(Math.max(1, strokeWidth - 1))}><MinusIcon size={12} /></button>
              <input type="range" min="1" max="50" value={strokeWidth} onChange={(e) => handleStrokeWidthChange(Number(e.target.value))} className="settings-slider" />
              <button className="mini-btn" onClick={() => handleStrokeWidthChange(Math.min(50, strokeWidth + 1))}><Plus size={12} /></button>
            </div>
          </div>
        )}

        {showTextSettings && (
          <>
            <div className="settings-group">
              <label>Font Size: {fontSize}</label>
              <div className="settings-controls">
                <button className="mini-btn" onClick={() => handleFontSizeChange(Math.max(8, fontSize - 2))}><MinusIcon size={12} /></button>
                <input type="range" min="8" max="120" value={fontSize} onChange={(e) => handleFontSizeChange(Number(e.target.value))} className="settings-slider" />
                <button className="mini-btn" onClick={() => handleFontSizeChange(Math.min(120, fontSize + 2))}><Plus size={12} /></button>
              </div>
            </div>
            <div className="settings-group">
              <label>Font Family</label>
              <select value={fontFamily} onChange={(e) => handleFontFamilyChange(e.target.value)} className="font-select">
                {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    )}
  </>
  );
};


export default Toolbox;

