import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  MousePointer2, Pencil, Eraser, Minus, ArrowRight, 
  Square, Circle, Type, Undo2, Redo2, Download, Save, FolderOpen, PenTool, LogOut
} from 'lucide-react';
import useCanvasStore from '../store/useCanvasStore';
import './Toolbox.css';

const Toolbox = () => {
  const { tool, setTool, undo, redo, strokeColor, setStrokeColor, elements, setElements, clearStore } = useCanvasStore();
  const navigate = useNavigate();

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
    { id: 'text', icon: Type, label: 'Text' },
  ];

  return (
    <div className="toolbox-container">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', animation: 'pulse 2s infinite ease-in-out' }} title="SD-Draw">
        <PenTool size={28} color="#007BFF" />
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

      <div className="color-section">
        <label>Color</label>
        <input 
          type="color" 
          value={strokeColor} 
          onChange={(e) => setStrokeColor(e.target.value)}
          className="color-picker"
        />
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
  );
};

export default Toolbox;
