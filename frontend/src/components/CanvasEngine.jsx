import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle, Arrow, Text, Transformer, RegularPolygon, Star, Group } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import useCanvasStore from '../store/useCanvasStore';
import useCollaboration from '../hooks/useCollaboration';

const CanvasEngine = () => {
  const { 
    elements, setElements, tool, strokeColor, setStrokeColor, 
    strokeWidth, setStrokeWidth, fillColor, setFillColor, 
    eraserSize, setEraserSize, precisionEraserSize, setPrecisionEraserSize,
    canvasBgColor, setCanvasBgColor, 
    fontSize, setFontSize, fontFamily, setFontFamily, 
    undo, redo, isCollaborating, lastUpdateRemote
  } = useCanvasStore();

  const { broadcast } = useCollaboration();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState(null);
  const [textInput, setTextInput] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [lastPinchDist, setLastPinchDist] = useState(null);
  const [childElements, setChildElements] = useState([]);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [eraserPath, setEraserPath] = useState(null);
  const [elementsToDelete, setElementsToDelete] = useState(new Set());

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  // Collaboration Broadcast
  useEffect(() => {
    if (isCollaborating && !lastUpdateRemote) {
      broadcast({ type: 'ELEMENTS_UPDATE', elements });
    }
  }, [elements, isCollaborating, lastUpdateRemote, broadcast]);

  useEffect(() => {
    if (textInput && textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 50);
    }
  }, [textInput]);

  // Auto-resize
  useEffect(() => {
    const handleResize = () => {
      if (stageRef.current) {
        stageRef.current.width(window.innerWidth);
        stageRef.current.height(window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Set initial size
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent default touch behavior on canvas container (prevents page scroll/zoom while drawing)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventTouch = (e) => {
      // Allow default on textarea/input for text editing
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.cancelable) e.preventDefault();
    };

    container.addEventListener('touchstart', preventTouch, { passive: false });
    container.addEventListener('touchmove', preventTouch, { passive: false });

    return () => {
      container.removeEventListener('touchstart', preventTouch);
      container.removeEventListener('touchmove', preventTouch);
    };
  }, []);

  // Export functionality
  useEffect(() => {
    const handleExport = () => {
      if (stageRef.current) {
        setSelectedId(null);
        setTimeout(() => {
          const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
          const link = document.createElement('a');
          link.download = 'SD-Draw-Export.png';
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, 50);
      }
    };
    window.addEventListener('export-canvas', handleExport);
    return () => window.removeEventListener('export-canvas', handleExport);
  }, []);

  // Keyboard shortcuts and Ctrl key tracking
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Control') setCtrlPressed(true);

      // Ignore if typing in text input
      if (e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'input') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          setElements(elements.filter(el => el.id !== selectedId), true);
          setSelectedId(null);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Control') setCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, elements, selectedId, setElements]);

  // Auto-commit text on tool change
  useEffect(() => {
    if (textInput && tool !== 'text' && tool !== 'select') {
      handleTextareaBlur();
    }
  }, [tool]);

  // Update Transformer when selection or tool changes
  useEffect(() => {
    if (selectedId && (tool === 'select')) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne(`#${selectedId}`);
      if (selectedNode && trRef.current) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, tool, elements]);

  const getRelativePointerPosition = (stage) => {
    const pointerPosition = stage.getPointerPosition();
    const currentScale = stage.scaleX();
    return {
      x: (pointerPosition.x - stage.x()) / currentScale,
      y: (pointerPosition.y - stage.y()) / currentScale,
    };
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setPosition(newPos);
  };

  // Helper: get clientX/clientY from either mouse or touch event
  const getClientPos = (evt) => {
    if (evt.touches && evt.touches.length > 0) {
      return { clientX: evt.touches[0].clientX, clientY: evt.touches[0].clientY };
    }
    if (evt.changedTouches && evt.changedTouches.length > 0) {
      return { clientX: evt.changedTouches[0].clientX, clientY: evt.changedTouches[0].clientY };
    }
    return { clientX: evt.clientX, clientY: evt.clientY };
  };

  // Helper: get distance between two touch points (for pinch zoom)
  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const performPrecisionErase = (pos, lastPos) => {
    const radius = (precisionEraserSize || 10) / 2;

    const toLocal = (p, el) => {
      const ex = el.x || 0;
      const ey = el.y || 0;
      const rot = (el.rotation || 0) * Math.PI / 180;
      const sx = el.scaleX || 1;
      const sy = el.scaleY || 1;
      let x = p.x - ex;
      let y = p.y - ey;
      if (rot !== 0) {
        const cos = Math.cos(-rot);
        const sin = Math.sin(-rot);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx; y = ry;
      }
      x /= sx; y /= sy;
      return { x, y };
    };

    const distToSegment = (p, v, w) => {
      const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
      if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
      let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
      return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
    };

    setElements((prevElements) => {
      let changed = false;
      const nextElements = prevElements.map(el => {
        if (el.type !== 'pencil' || !el.points) return el;

        const localPos = toLocal(pos, el);
        const localLastPos = lastPos ? toLocal(lastPos, el) : null;
        
        // Simple bounding box check
        const bbox = el.bbox || { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
        const elStrokeWidth = el.strokeWidth || 2;
        const margin = radius + elStrokeWidth + 10;
        if (localPos.x < bbox.minX - margin || localPos.x > bbox.maxX + margin || 
            localPos.y < bbox.minY - margin || localPos.y > bbox.maxY + margin) {
          return el;
        }

        const newSegments = [];
        let currentSegment = [];
        let elChanged = false;

        for (let i = 0; i < el.points.length - 2; i += 2) {
          const p1 = { x: el.points[i], y: el.points[i + 1] };
          const p2 = { x: el.points[i + 2], y: el.points[i + 3] };
          
          const d = distToSegment(localPos, p1, p2);
          let isHit = d < (radius + elStrokeWidth / 2);
          if (!isHit && localLastPos) {
            isHit = distToSegment(p1, localLastPos, localPos) < (radius + elStrokeWidth / 2);
          }

          if (isHit) {
            if (currentSegment.length >= 4) newSegments.push(currentSegment);
            currentSegment = [];
            elChanged = true;
          } else {
            if (currentSegment.length === 0) currentSegment.push(p1.x, p1.y);
            currentSegment.push(p2.x, p2.y);
          }
        }
        if (currentSegment.length >= 4) newSegments.push(currentSegment);

        if (elChanged) {
          changed = true;
          return newSegments.map((seg, idx) => {
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (let k = 0; k < seg.length; k += 2) {
              if (seg[k] < sMinX) sMinX = seg[k]; if (seg[k] > sMaxX) sMaxX = seg[k];
              if (seg[k+1] < sMinY) sMinY = seg[k+1]; if (seg[k+1] > sMaxY) sMaxY = seg[k+1];
            }
            return {
              ...el,
              id: idx === 0 ? el.id : uuidv4(),
              points: seg,
              bbox: { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY }
            };
          });
        }
        return el;
      }).flat();

      return changed ? nextElements : prevElements;
    }, false);
  };

  const checkObjectHit = (el, pos, lastPos) => {
    const baseThreshold = 3;
    const sw = el.strokeWidth || 2;
    const threshold = baseThreshold + sw / 2;

    // 1. Setup transform helper
    const ex = el.x || 0;
    const ey = el.y || 0;
    const rot = (el.rotation || 0) * Math.PI / 180;
    const sx = el.scaleX || 1;
    const sy = el.scaleY || 1;

    // Helper: Transform global point to local element space
    const toLocal = (p) => {
      let x = p.x - ex;
      let y = p.y - ey;
      if (rot !== 0) {
        const cos = Math.cos(-rot);
        const sin = Math.sin(-rot);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx; y = ry;
      }
      x /= sx; y /= sy;
      return { x, y };
    };

    const localPos = toLocal(pos);
    const localLastPos = lastPos ? toLocal(lastPos) : null;

    // 2. Distance to Segment helper
    const dts = (p, v, w) => {
      const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
      if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
    };

    // Helper: Check if eraser swipe (localLastPos -> localPos) hits a segment v-w
    const isSwipeHit = (v, w) => {
      if (!localLastPos) return dts(localPos, v, w) < threshold;
      // Check segment-to-segment by sampling or checking distances to endpoints
      return dts(v, localLastPos, localPos) < threshold || 
             dts(w, localLastPos, localPos) < threshold ||
             dts(localPos, v, w) < threshold ||
             dts(localLastPos, v, w) < threshold;
    };

    if (el.type === 'pencil' || el.type === 'line' || el.type === 'arrow') {
      if (el.points) {
        for (let j = 0; j < el.points.length - 2; j += 2) {
          if (isSwipeHit({x:el.points[j], y:el.points[j+1]}, {x:el.points[j+2], y:el.points[j+3]})) return true;
        }
      }
    } else if (el.type === 'rect') {
      const w = el.width || 0, h = el.height || 0;
      if (isSwipeHit({x:0, y:0}, {x:w, y:0}) || isSwipeHit({x:w, y:0}, {x:w, y:h}) ||
          isSwipeHit({x:w, y:h}, {x:0, y:h}) || isSwipeHit({x:0, y:h}, {x:0, y:0})) return true;
    } else if (el.type === 'circle') {
      const r = el.radius || 0;
      const d1 = Math.sqrt(localPos.x**2 + localPos.y**2);
      if (localLastPos) {
        const d2 = Math.sqrt(localLastPos.x**2 + localLastPos.y**2);
        if ((d1 < r && d2 > r) || (d1 > r && d2 < r)) return true;
        return dts({x:0, y:0}, localLastPos, localPos) > r - threshold && dts({x:0, y:0}, localLastPos, localPos) < r + threshold;
      }
      if (Math.abs(d1 - r) < threshold) return true;
    } else if (['triangle', 'diamond', 'pentagon', 'hexagon', 'star'].includes(el.type)) {
      const sides = el.type === 'triangle' ? 3 : (el.type === 'diamond' ? 4 : (el.type === 'pentagon' ? 5 : (el.type === 'hexagon' ? 6 : 10)));
      const pts = [];
      if (el.type === 'star') {
        const r1 = el.outerRadius || 0, r2 = el.innerRadius || 0;
        for (let n = 0; n < 10; n++) {
          const r = n % 2 === 0 ? r1 : r2;
          const angle = (n * Math.PI) / 5;
          pts.push({ x: r * Math.sin(angle), y: -r * Math.cos(angle) });
        }
      } else {
        const r = el.radius || 0;
        for (let n = 0; n < sides; n++) {
          const angle = (n * 2 * Math.PI) / sides;
          pts.push({ x: r * Math.sin(angle), y: -r * Math.cos(angle) });
        }
      }
      for (let n = 0; n < pts.length; n++) {
        if (isSwipeHit(pts[n], pts[(n+1) % pts.length])) return true;
      }
    } else if (el.type === 'text') {
      const tw = el.width || 100, th = el.fontSize || 20;
      if (localPos.x >= -threshold && localPos.x <= tw + threshold && localPos.y >= -threshold && localPos.y <= th + threshold) return true;
      if (localLastPos && (localLastPos.x >= -threshold && localLastPos.x <= tw + threshold && localLastPos.y >= -threshold && localLastPos.y <= th + threshold)) return true;
    }
    return false;
  };

  // Unified pointer-down handler (works for both mouse and touch)
  const handlePointerDown = (e) => {
    if (textInput) {
      handleTextareaBlur();
      return;
    }

    const evt = e.evt;
    // For mouse: skip middle/right click
    if (evt.button === 1 || evt.button === 2) return;

    // For touch: if two fingers, cancel any drawing and start pinch
    if (evt.touches && evt.touches.length >= 2) {
      // Cancel any in-progress drawing from the first finger
      if (isDrawing) {
        setIsDrawing(false);
        setCurrentElement(null);
      }
      setLastPinchDist(getTouchDist(evt.touches));
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    // If typing text, commit it if clicking elsewhere
    if (textInput) {
      handleTextareaBlur();
    }

    const pos = getRelativePointerPosition(stage);
    if (!pos) return;

    // Ctrl + Left Mouse to move elements
    const isMovingWithCtrl = evt.ctrlKey && !evt.touches;

    if (tool === 'select' || isMovingWithCtrl) {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        setSelectedId(null);
      } else {
        const id = e.target.id();
        if (id) {
          setSelectedId(id);
          
          // Update toolbox settings to match selected element
          const el = elements.find(e => e.id === id);
          if (el) {
            if (el.stroke) setStrokeColor(el.stroke);
            if (el.strokeWidth) setStrokeWidth(el.strokeWidth);
            if (el.fontSize) setFontSize(el.fontSize);
            if (el.fontFamily) setFontFamily(el.fontFamily);
          }
        }
      }
      return;
    }

    if (tool === 'text') {
      const isTextNode = e.target && e.target.className === 'Text';
      if (isTextNode) {
        const el = elements.find(el => el.id === e.target.id());
        if (el) {
          handleTextDblClick(e, el);
          return;
        }
      }

      const { clientX, clientY } = getClientPos(evt);
      setTextInput({
        x: pos.x,
        y: pos.y,
        screenX: clientX,
        screenY: clientY,
        value: '',
        width: 150
      });
      return;
    }

    if (tool === 'precision-eraser' && !ctrlPressed) {
      setEraserPath([pos.x, pos.y]);
      setIsDrawing(true);
      performPrecisionErase(pos, null);
      return;
    }

    if (tool === 'eraser' && !ctrlPressed) {
      setIsDrawing(true);
      setEraserPath([pos.x, pos.y]);
      setElementsToDelete(new Set());

      for (let i = elements.length - 1; i >= 0; i--) {
        if (checkObjectHit(elements[i], pos, null)) {
          setElementsToDelete(new Set([elements[i].id]));
          break;
        }
      }
      return;
    }

    // Deselect if switching to drawing tool
    setSelectedId(null);
    setIsDrawing(true);

    const newElement = {
      id: uuidv4(),
      type: tool,
      stroke: strokeColor,
      strokeWidth: Number(strokeWidth) || 2,
      fill: fillColor,
      x: 0,
      y: 0
    };

    if (tool === 'pencil') {
      // Line needs at least 2 points (4 coordinates) to be visible in some Konva versions
      newElement.points = [pos.x, pos.y, pos.x, pos.y];
    } else if (tool === 'line' || tool === 'arrow') {
      newElement.points = [pos.x, pos.y, pos.x, pos.y];
    } else if (tool === 'rect') {
      newElement.x = pos.x;
      newElement.y = pos.y;
      newElement.width = 0;
      newElement.height = 0;
    } else if (tool === 'circle') {
      newElement.x = pos.x;
      newElement.y = pos.y;
      newElement.radius = 0;
    } else if (tool === 'triangle' || tool === 'diamond' || tool === 'pentagon' || tool === 'hexagon') {
      newElement.x = pos.x;
      newElement.y = pos.y;
      newElement.radius = 0;
    } else if (tool === 'star') {
      newElement.x = pos.x;
      newElement.y = pos.y;
      newElement.numPoints = 5;
      newElement.innerRadius = 0;
      newElement.outerRadius = 0;
    }

    setCurrentElement(newElement);
  };

  // Unified pointer-move handler
  const handlePointerMove = (e) => {
    const evt = e.evt;

    // Handle pinch-to-zoom with two fingers
    if (evt.touches && evt.touches.length >= 2) {
      // Cancel any drawing that was started by the first finger
      if (isDrawing) {
        setIsDrawing(false);
        setCurrentElement(null);
      }

      const newDist = getTouchDist(evt.touches);
      if (lastPinchDist) {
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const scaleChange = newDist / lastPinchDist;
        const newScale = Math.max(0.1, Math.min(10, oldScale * scaleChange));

        // Get center of two fingers for zoom-to-center
        const cx = (evt.touches[0].clientX + evt.touches[1].clientX) / 2;
        const cy = (evt.touches[0].clientY + evt.touches[1].clientY) / 2;

        const mousePointTo = {
          x: (cx - stage.x()) / oldScale,
          y: (cy - stage.y()) / oldScale,
        };

        setScale(newScale);
        setPosition({
          x: cx - mousePointTo.x * newScale,
          y: cy - mousePointTo.y * newScale,
        });
      }
      setLastPinchDist(newDist);
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;
    const pos = getRelativePointerPosition(stage);
    if (!pos) return;



    if (tool === 'precision-eraser' || tool === 'eraser') {
      if (tool === 'eraser' && isDrawing) {
        setEraserPath(prev => (prev && prev.length >= 2 ? [...prev, pos.x, pos.y] : [pos.x, pos.y]));
      } else {
        setEraserPath([pos.x, pos.y]);
      }
    }

    if (tool === 'precision-eraser' && isDrawing && !ctrlPressed) {
      const lastPos = eraserPath && eraserPath.length >= 2 ? { x: eraserPath[0], y: eraserPath[1] } : pos;
      performPrecisionErase(pos, lastPos);
      return;
    }

    if (tool === 'eraser' && isDrawing && !ctrlPressed) {
      const lastPos = eraserPath && eraserPath.length >= 2 ? { x: eraserPath[eraserPath.length - 2], y: eraserPath[eraserPath.length - 1] } : null;

      // Use functional update to find and mark elements to delete
      setElements((prevElements) => {
        let hitId = null;
        for (let i = prevElements.length - 1; i >= 0; i--) {
          const el = prevElements[i];
          if (checkObjectHit(el, pos, lastPos)) {
            hitId = el.id;
            break;
          }
        }
        
        if (hitId) {
          setElementsToDelete(prev => {
            const next = new Set(prev);
            next.add(hitId);
            return next;
          });
        }
        return prevElements;
      }, false);
      return;
    }

    if (!isDrawing || !currentElement) return;

    const updatedElement = { ...currentElement };

    if (tool === 'pencil') {
      updatedElement.points = [...updatedElement.points, pos.x, pos.y];
    } else if (tool === 'line' || tool === 'arrow') {
      updatedElement.points = [updatedElement.points[0], updatedElement.points[1], pos.x, pos.y];
    } else if (tool === 'rect') {
      updatedElement.width = pos.x - updatedElement.x;
      updatedElement.height = pos.y - updatedElement.y;
    } else if (tool === 'circle' || tool === 'triangle' || tool === 'diamond' || tool === 'pentagon' || tool === 'hexagon') {
      const dx = pos.x - updatedElement.x;
      const dy = pos.y - updatedElement.y;
      updatedElement.radius = Math.sqrt(dx * dx + dy * dy);
    } else if (tool === 'star') {
      const dx = pos.x - updatedElement.x;
      const dy = pos.y - updatedElement.y;
      updatedElement.outerRadius = Math.sqrt(dx * dx + dy * dy);
      updatedElement.innerRadius = updatedElement.outerRadius / 2;
    }

    setCurrentElement(updatedElement);
  };

  // Unified pointer-up handler
  const handlePointerUp = () => {
    // Reset pinch state
    setLastPinchDist(null);

    if (tool === 'precision-eraser' && isDrawing) {
      setEraserPath(null);
      setElements(prev => prev, true); 
    }

    if (tool === 'eraser' && isDrawing && !ctrlPressed) {
      if (elementsToDelete.size > 0) {
        setElements(prev => prev.filter(el => !elementsToDelete.has(el.id)), true);
      }
      setElementsToDelete(new Set());
      setEraserPath(null);
    }

    if (currentElement) {
      setElements(prev => {
        const finalElement = { ...currentElement };
        if (finalElement.type === 'pencil' && finalElement.points) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (let i = 0; i < finalElement.points.length; i += 2) {
            const px = finalElement.points[i];
            const py = finalElement.points[i + 1];
            if (px < minX) minX = px; if (px > maxX) maxX = px;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
          }
          finalElement.bbox = { minX, minY, maxX, maxY };
        }
        return [...prev, finalElement];
      }, true);
      setCurrentElement(null);
    }

    setIsDrawing(false);
  };

  const handleTextareaChange = (e) => {
    setTextInput({ ...textInput, value: e.target.value });
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Escape') {
      setTextInput(null);
    }
  };

  const handleTextareaBlur = () => {
    const width = textareaRef.current ? textareaRef.current.offsetWidth / scale : undefined;

    if (textInput && textInput.value.trim() !== '') {
      setElements(prev => {
        if (textInput.id && prev.find(el => el.id === textInput.id)) {
          return prev.map(e =>
            e.id === textInput.id ? { 
              ...e, 
              text: textInput.value, 
              width,
              fontSize: fontSize || e.fontSize,
              fontFamily: fontFamily || e.fontFamily,
              stroke: strokeColor || e.stroke,
              fill: strokeColor || e.fill
            } : e
          );
        } else {
          const newElement = {
            id: textInput.id || uuidv4(),
            type: 'text',
            x: textInput.x,
            y: textInput.y,
            width,
            text: textInput.value,
            stroke: strokeColor,
            fill: strokeColor,
            fontSize: fontSize || 20,
            fontFamily: fontFamily || 'sans-serif',
          };
          return [...prev, newElement];
        }
      }, true);
    } else if (textInput && textInput.id) {
      setElements(prev => prev.filter(e => e.id !== textInput.id), true);
    }
    setTextInput(null);
  };

  const handleTextDblClick = (e, el) => {
    if (tool !== 'select' && tool !== 'text') return;
    const textNode = e.target;
    const stage = stageRef.current;
    const absolutePos = textNode.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    setTextInput({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width || (textNode.width() + 10),
      height: textNode.height() + 10,
      screenX: stageBox.left + absolutePos.x,
      screenY: stageBox.top + absolutePos.y,
      value: el.text
    });
  };

  const handleDragStart = (e) => {
    const id = e.target.id();
    const draggedNode = e.target;
    const draggedRect = draggedNode.getClientRect();
    const draggedArea = draggedRect.width * draggedRect.height;
    const draggedIndex = elements.findIndex(el => el.id === id);

    // Identify child elements (those entirely within the dragged element)
    const children = elements.filter((el, index) => {
      if (el.id === id) return false;
      
      // Only include elements that are "above" the dragged element in z-index
      // and were placed after it (or are smaller)
      if (index < draggedIndex) return false;

      const node = stageRef.current.findOne(`#${el.id}`);
      if (!node) return false;
      const rect = node.getClientRect();
      const rectArea = rect.width * rect.height;

      // Child must be smaller than parent to avoid accidental grouping
      if (rectArea >= draggedArea) return false;
      
      return (
        rect.x >= draggedRect.x &&
        rect.y >= draggedRect.y &&
        rect.x + rect.width <= draggedRect.x + draggedRect.width &&
        rect.y + rect.height <= draggedRect.y + draggedRect.height
      );
    }).map(el => ({
      id: el.id,
      offsetX: el.x - draggedNode.x(),
      offsetY: el.y - draggedNode.y()
    }));

    setChildElements(children);
  };

  const handleDragMove = (e) => {
    const draggedNode = e.target;
    const newElements = elements.map(el => {
      const child = childElements.find(c => c.id === el.id);
      if (child) {
        return {
          ...el,
          x: draggedNode.x() + child.offsetX,
          y: draggedNode.y() + child.offsetY
        };
      }
      if (el.id === draggedNode.id()) {
        return {
          ...el,
          x: draggedNode.x(),
          y: draggedNode.y()
        };
      }
      return el;
    });
    setElements(newElements, false); // Don't add to history during drag move
  };

  const handleDragEnd = (e) => {
    // Add final state to history
    setElements(prev => prev, true);
    setChildElements([]);
  };

  const handleTransformEnd = (e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to 1 to avoid double scaling visually
    node.scaleX(1);
    node.scaleY(1);

    setElements(prev => prev.map(el => {
      if (el.id === node.id()) {
        return {
          ...el,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: el.width ? Math.max(5, el.width * scaleX) : undefined,
          height: el.height ? Math.max(5, el.height * scaleY) : undefined,
          radius: el.radius ? Math.max(5, el.radius * scaleX) : undefined,
          innerRadius: el.innerRadius ? Math.max(2, el.innerRadius * scaleX) : undefined,
          outerRadius: el.outerRadius ? Math.max(5, el.outerRadius * scaleX) : undefined,
          scaleX: el.type === 'pencil' ? (el.scaleX || 1) * scaleX : 1,
          scaleY: el.type === 'pencil' ? (el.scaleY || 1) * scaleY : 1,
        };
      }
      return el;
    }), true);
  };

  const renderElement = (el) => {
    const isMarkedForDeletion = elementsToDelete.has(el.id);
    
    const commonProps = {
      id: el.id,
      key: el.id,
      x: el.x || 0,
      y: el.y || 0,
      rotation: el.rotation || 0,
      scaleX: el.scaleX || 1,
      scaleY: el.scaleY || 1,
      draggable: tool === 'select' || ctrlPressed,
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onTransformEnd: handleTransformEnd,
      opacity: isMarkedForDeletion ? 0.3 : 1,
      stroke: isMarkedForDeletion ? '#ff4d4d' : undefined,
    };

    switch (el.type) {
      case 'pencil':
        if (!el.points || el.points.length < 2) return null;
        return <Line {...commonProps} points={el.points} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" />;
      case 'line':
        return <Line {...commonProps} points={el.points} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} />;
      case 'arrow':
        return <Arrow {...commonProps} points={el.points} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} fill={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} />;
      case 'rect':
        return <Rect {...commonProps} width={el.width} height={el.height} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'circle':
        return <Circle {...commonProps} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'triangle':
        return <RegularPolygon {...commonProps} sides={3} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'diamond':
        return <RegularPolygon {...commonProps} sides={4} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'pentagon':
        return <RegularPolygon {...commonProps} sides={5} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'hexagon':
        return <RegularPolygon {...commonProps} sides={6} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'star':
        return <Star {...commonProps} numPoints={5} innerRadius={el.innerRadius} outerRadius={el.outerRadius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'text':
        return (
          <Text
            {...commonProps}
            text={el.text}
            fontSize={el.fontSize || 20}
            fontFamily={el.fontFamily || 'sans-serif'}
            fill={isMarkedForDeletion ? '#ff4d4d' : el.fill}
            width={el.width}
            onDblClick={(e) => handleTextDblClick(e, el)}
            onDblTap={(e) => handleTextDblClick(e, el)}
            visible={!textInput || textInput.id !== el.id}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        backgroundColor: canvasBgColor,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        cursor: ctrlPressed 
          ? (isDrawing ? 'grabbing' : 'grab') 
          : (tool === 'select' ? 'default' : (tool === 'text' ? 'text' : 'crosshair')),
        touchAction: 'none'
      }}
    >
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={(tool === 'select' || ctrlPressed) && !selectedId}
        ref={stageRef}
      >
        <Layer>
          {elements.map(renderElement)}
          {currentElement && renderElement(currentElement)}
          
          {/* Visual Eraser Path (Object Eraser) - only when actually drawing/erasing multiple */}
          {eraserPath && tool === 'eraser' && isDrawing && (
            <Line
              points={eraserPath}
              stroke="#ff4d4d"
              strokeWidth={2}
              dash={[5, 5]}
              lineCap="round"
              lineJoin="round"
              opacity={0.6}
              listening={false}
            />
          )}

          {/* Precision Eraser Head / Regular Eraser Head */}
          {(tool === 'precision-eraser' || tool === 'eraser') && eraserPath && eraserPath.length >= 2 && (
            <Group 
              x={eraserPath[eraserPath.length - 2]} 
              y={eraserPath[eraserPath.length - 1]} 
              listening={false}
            >
              <Circle
                radius={tool === 'precision-eraser' ? (precisionEraserSize || 10) / 2 : 3}
                fill="white"
                stroke="#666"
                strokeWidth={1}
                opacity={0.5}
              />
              {tool === 'precision-eraser' && (
                <Group opacity={0.8}>
                  <Line points={[-4, 0, 4, 0]} stroke="#333" strokeWidth={1} />
                  <Line points={[0, -4, 0, 4]} stroke="#333" strokeWidth={1} />
                </Group>
              )}
            </Group>
          )}

          {tool === 'select' && <Transformer ref={trRef} boundBoxFunc={(oldBox, newBox) => {
            // limit resize
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }} />}
        </Layer>
      </Stage>
      {textInput && (
        <textarea
          ref={textareaRef}
          value={textInput.value}
          onChange={handleTextareaChange}
          onKeyDown={handleTextareaKeyDown}
          onBlur={handleTextareaBlur}
          style={{
            position: 'absolute',
            top: textInput.screenY,
            left: textInput.screenX,
            zIndex: 1000,
            margin: 0,
            padding: 0,
            border: '1px dashed #007BFF',
            background: 'transparent',
            color: strokeColor,
            fontSize: `${(fontSize || 20) * scale}px`,
            fontFamily: fontFamily || 'sans-serif',
            outline: 'none',
            resize: 'both',
            width: textInput.width ? `${textInput.width * scale}px` : `${150 * scale}px`,
            height: textInput.height ? `${textInput.height * scale}px` : undefined,
            overflow: 'hidden',
            minHeight: `${30 * scale}px`,
            minWidth: `${50 * scale}px`,
          }}
        />
      )}
    </div>
  );
};

export default CanvasEngine;
