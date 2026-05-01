import React from 'react';
import {
  MousePointer2, Pencil, Eraser, Square, Circle, Triangle, Star,
  Type, Undo2, Redo2, Download, Save, FolderOpen, LogOut,
  Minus, ArrowRight, Plus, Minus as MinusIcon, PencilLine,
  Diamond, Pentagon, Hexagon, Users, Copy, Check, Link,
  ChevronLeft, ChevronRight, Keyboard, Info, PaintBucket
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useCanvasStore from '../store/useCanvasStore';
import Logo from './Logo';
import './Toolbox.css';

const Toolbox = () => {
  const {
    tool, setTool, strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth, fillColor, setFillColor,
    eraserSize, setEraserSize, precisionEraserSize, setPrecisionEraserSize,
    canvasBgColor, setCanvasBgColor,
    fontSize, setFontSize, fontFamily, setFontFamily,
    elements, setElements, undo, redo, clearStore,
    peerId, connections, isCollaborating
  } = useCanvasStore();

  const [roomInput, setRoomInput] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const navigate = useNavigate();

  const handleStrokeWidthChange = (val) => setStrokeWidth(val);
  const handleStrokeColorChange = (val) => setStrokeColor(val);

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('sd_token');
      if (!token) return;

      await axios.put('/api/canvas', { elements }, {
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
      if (!token) return;

      const res = await axios.get('/api/canvas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        // Backend returns elements array directly
        setElements(res.data, false);
        alert('Canvas loaded!');
      }
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
    localStorage.removeItem('sd_guest');
    clearStore();
    navigate('/');
  };

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'pencil', icon: Pencil, label: 'Pencil' },
    { id: 'eraser', icon: Eraser, label: 'Object Eraser' },
    { id: 'precision-eraser', icon: PencilLine, label: 'Precision Eraser' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'triangle', icon: Triangle, label: 'Triangle' },
    { id: 'diamond', icon: Diamond, label: 'Diamond' },
    { id: 'pentagon', icon: Pentagon, label: 'Pentagon' },
    { id: 'hexagon', icon: Hexagon, label: 'Hexagon' },
    { id: 'star', icon: Star, label: 'Star' },
    { id: 'fill', icon: PaintBucket, label: 'Flood Fill' },
    { id: 'text', icon: Type, label: 'Text' },
  ];

  const fonts = [
    { name: 'Sans-serif', value: 'sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: 'Cursive', value: 'cursive' },
    { name: 'Impact', value: 'Impact' },
  ];

  const isGuest = localStorage.getItem('sd_guest') === 'true';

  // Determine which settings to show in the floating popup
  const showStrokeSettings = ['pencil', 'line', 'arrow', 'rect', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'].includes(tool);
  const showTextSettings = tool === 'text';
  const showPrecisionSettings = tool === 'precision-eraser';

  const handleShowShortcuts = () => {
    alert(
      "SD-Draw Keyboard Shortcuts:\n" +
      "---------------------------\n" +
      "• Ctrl + Left Click Hold: Pan Canvas\n" +
      "• Middle Click Drag: Pan Canvas\n" +
      "• Ctrl + Z: Undo\n" +
      "• Ctrl + Y / Ctrl + Shift + Z: Redo\n" +
      "• Delete / Backspace: Delete Selected\n" +
      "• Double Click (or Select + Click): Edit Text"
    );
  };

  return (
    <>
      <button
        className={`toolbox-toggle-btn ${isCollapsed ? 'collapsed' : ''}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Show Toolbox" : "Hide Toolbox"}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className={`toolbox-container ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', animation: 'pulse 2s infinite ease-in-out', position: 'relative' }} title="SD-Draw">
          <Logo size={40} />
          {isGuest && <div style={{ position: 'absolute', bottom: -5, right: 0, fontSize: '8px', background: '#A855F7', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>GUEST</div>}
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
            <label>Fill</label>
            <input
              type="color"
              value={fillColor}
              onChange={(e) => setFillColor(e.target.value)}
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
          <button
            className="action-btn"
            title={isGuest ? "Register to Save" : "Save"}
            onClick={handleSave}
            disabled={isGuest}
            style={{ opacity: isGuest ? 0.3 : 1, cursor: isGuest ? 'not-allowed' : 'pointer' }}
          >
            <Save size={18} />
          </button>
          <button
            className="action-btn"
            title={isGuest ? "Register to Load" : "Load"}
            onClick={handleLoad}
            disabled={isGuest}
            style={{ opacity: isGuest ? 0.3 : 1, cursor: isGuest ? 'not-allowed' : 'pointer' }}
          >
            <FolderOpen size={18} />
          </button>
          <button className="action-btn" title="Export to PNG" onClick={() => window.dispatchEvent(new CustomEvent('export-canvas'))}>
            <Download size={18} />
          </button>
          <button
            className="action-btn keyboard-btn"
            title="Shortcut Tips"
            onClick={handleShowShortcuts}
          >
            <Keyboard size={18} />
          </button>
        </div>

        <div className="toolbox-divider"></div>

        <div className="toolbox-header">Collaboration</div>
        <div className="collab-section">
          <div className="peer-id-container">
            <label>Your ID</label>
            <div className="peer-id-box">
              <span>{peerId ? peerId.substring(0, 8) + '...' : 'Loading...'}</span>
              <button
                className="icon-btn"
                onClick={() => {
                  if (peerId) {
                    navigator.clipboard.writeText(peerId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                title="Copy Peer ID"
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="join-container">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              className="room-input"
            />
            <button
              className="join-btn"
              onClick={() => {
                if (roomInput) {
                  // This will be handled by a global event or the hook
                  window.dispatchEvent(new CustomEvent('join-room', { detail: roomInput }));
                  setRoomInput('');
                }
              }}
            >
              Join
            </button>
          </div>

          <div className="collab-status">
            <div className={`status-dot ${isCollaborating ? 'active' : ''}`}></div>
            <span>{isCollaborating ? `${connections.length} Peer(s)` : 'Solo Mode'}</span>
          </div>
        </div>

        <div className="toolbox-divider"></div>

        <div className="logout-section">
          <button className="premium-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Floating Settings Popup */}
      {!isCollapsed && (showStrokeSettings || showTextSettings || showPrecisionSettings) && (
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

          {showPrecisionSettings && (
            <div className="settings-group">
              <label>Precision Eraser Size: {precisionEraserSize}</label>
              <div className="settings-controls">
                <button className="mini-btn" onClick={() => setPrecisionEraserSize(Math.max(2, precisionEraserSize - 2))}><MinusIcon size={12} /></button>
                <input type="range" min="2" max="100" value={precisionEraserSize} onChange={(e) => setPrecisionEraserSize(Number(e.target.value))} className="settings-slider" />
                <button className="mini-btn" onClick={() => setPrecisionEraserSize(Math.min(100, precisionEraserSize + 2))}><Plus size={12} /></button>
              </div>
            </div>
          )}

          {showTextSettings && (
            <>
              <div className="settings-group">
                <label>Font Size: {fontSize}</label>
                <div className="settings-controls">
                  <button className="mini-btn" onClick={() => setFontSize(Math.max(8, fontSize - 2))}><MinusIcon size={12} /></button>
                  <input type="range" min="8" max="100" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="settings-slider" />
                  <button className="mini-btn" onClick={() => setFontSize(Math.min(100, fontSize + 2))}><Plus size={12} /></button>
                </div>
              </div>
              <div className="settings-group">
                <label>Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="font-select"
                >
                  {fonts.map(f => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
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
