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
    const radiusSq = radius * radius;
    let elementsChanged = false;
    const nextElements = [];

    // Helper: Distance from point p to line segment v-w
    const distToSegment = (p, v, w) => {
      const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
      if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
    };

    // Advanced Clipping Helper: Finds intersections of segment P1P2 with circle C,R
    const getCircleSegmentIntersections = (p1, p2, c, r) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const fx = p1.x - c.x;
      const fy = p1.y - c.y;

      const a = dx * dx + dy * dy;
      const b = 2 * (fx * dx + fy * dy);
      const c_val = fx * fx + fy * fy - r * r;

      let discriminant = b * b - 4 * a * c_val;
      if (discriminant < 0) return [];
      
      discriminant = Math.sqrt(discriminant);
      const t1 = (-b - discriminant) / (2 * a);
      const t2 = (-b + discriminant) / (2 * a);

      const points = [];
      if (t1 >= 0 && t1 <= 1) points.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
      if (t2 >= 0 && t2 <= 1) points.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
      return points;
    };
    for (const el of elements) {
      if (el.type === 'pencil' && el.points) {
        const ex = el.x || 0;
        const ey = el.y || 0;
        const localPos = { x: pos.x - ex, y: pos.y - ey };
        const localLastPos = lastPos ? { x: lastPos.x - ex, y: lastPos.y - ey } : null;

        // Bounding box check for performance - account for movement path
        const bbox = el.bbox || { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
        const elStrokeWidth = el.strokeWidth || 2;
        const margin = radius + elStrokeWidth + 20;
        
        const minEraserX = localLastPos ? Math.min(localPos.x, localLastPos.x) : localPos.x;
        const maxEraserX = localLastPos ? Math.max(localPos.x, localLastPos.x) : localPos.x;
        const minEraserY = localLastPos ? Math.min(localPos.y, localLastPos.y) : localPos.y;
        const maxEraserY = localLastPos ? Math.max(localPos.y, localLastPos.y) : localPos.y;

        if (maxEraserX < bbox.minX - margin || minEraserX > bbox.maxX + margin || 
            maxEraserY < bbox.minY - margin || minEraserY > bbox.maxY + margin) {
          nextElements.push(el);
          continue;
        }

        const newSegments = [];
        let currentSegment = [];

        for (let i = 0; i < el.points.length - 2; i += 2) {
          const p1 = { x: el.points[i], y: el.points[i + 1] };
          const p2 = { x: el.points[i + 2], y: el.points[i + 3] };

          // Calculate distance from eraser center to the pencil segment
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const l2 = dx * dx + dy * dy;
          let t = l2 === 0 ? 0 : ((localPos.x - p1.x) * dx + (localPos.y - p1.y) * dy) / l2;
          t = Math.max(0, Math.min(1, t));
          const closestPoint = { x: p1.x + t * dx, y: p1.y + t * dy };
          const dist = Math.sqrt(Math.pow(localPos.x - closestPoint.x, 2) + Math.pow(localPos.y - closestPoint.y, 2));

          // Trigger hit if eraser touches the VISUAL body (path + strokeWidth/2)
          // Also check swipe from lastPos
          let isHit = dist < (radius + elStrokeWidth / 2);
          if (!isHit && localLastPos) {
            // Check if p1 or p2 was passed by the eraser's movement segment
            isHit = distToSegment(p1, localLastPos, localPos) < (radius + elStrokeWidth / 2);
          }

          if (isHit) {
            // FULL BREAK: Split the line at this segment
            // To create a visible gap, we discard this segment and potentially trim adjacent ones
            if (currentSegment.length >= 4) {
              // Finish the current line before the break
              // Optional: trim the end of currentSegment to leave a gap
              newSegments.push(currentSegment);
            }
            currentSegment = []; // Start fresh after the break
            elementsChanged = true;
          } else {
            if (currentSegment.length === 0) currentSegment.push(p1.x, p1.y);
            currentSegment.push(p2.x, p2.y);
          }
        }
        
        if (currentSegment.length >= 4) newSegments.push(currentSegment);

        if (newSegments.length === 0) {
          elementsChanged = true;
        } else if (newSegments.length === 1 && newSegments[0].length === el.points.length && !elementsChanged) {
          nextElements.push(el);
        } else {
          newSegments.forEach((seg, idx) => {
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (let k = 0; k < seg.length; k += 2) {
              if (seg[k] < sMinX) sMinX = seg[k]; if (seg[k] > sMaxX) sMaxX = seg[k];
              if (seg[k+1] < sMinY) sMinY = seg[k+1]; if (seg[k+1] > sMaxY) sMaxY = seg[k+1];
            }
            nextElements.push({
              ...el,
              id: idx === 0 ? el.id : uuidv4(),
              points: seg,
              bbox: { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY }
            });
          });
        }
      } else {
        nextElements.push(el);
      }
    }

    if (elementsChanged) {
      setElements(nextElements, false);
    }
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
      setElementsToDelete(new Set()); // Start fresh

      const baseThreshold = 3;
      const dts = (p, v, w) => {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
      };

      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const ex = el.x || 0;
        const ey = el.y || 0;
        const localPos = { x: pos.x - ex, y: pos.y - ey };
        let isHit = false;
        
        const sw = el.strokeWidth || 2;
        const threshold = baseThreshold + sw / 2;

        if (el.type === 'pencil' || el.type === 'line' || el.type === 'arrow') {
          if (el.points) {
            for (let j = 0; j < el.points.length - 2; j += 2) {
              if (dts(localPos, {x:el.points[j], y:el.points[j+1]}, {x:el.points[j+2], y:el.points[j+3]}) < threshold) { isHit = true; break; }
            }
          }
        } else if (el.type === 'rect') {
          const w = el.width || 0, h = el.height || 0;
          if (dts(localPos, {x:0, y:0}, {x:w, y:0}) < threshold || dts(localPos, {x:w, y:0}, {x:w, y:h}) < threshold ||
              dts(localPos, {x:w, y:h}, {x:0, y:h}) < threshold || dts(localPos, {x:0, y:h}, {x:0, y:0}) < threshold) isHit = true;
        } else if (el.type === 'circle') {
          const dist = Math.sqrt(Math.pow(localPos.x, 2) + Math.pow(localPos.y, 2));
          if (Math.abs(dist - (el.radius || 0)) < threshold) isHit = true;
        } else if (['triangle', 'diamond', 'pentagon', 'hexagon'].includes(el.type)) {
          const r = el.radius || 0;
          const sides = el.type === 'triangle' ? 3 : (el.type === 'diamond' ? 4 : (el.type === 'pentagon' ? 5 : 6));
          const pts = [];
          for (let n = 0; n < sides; n++) {
            const angle = (n * 2 * Math.PI) / sides;
            pts.push({ x: r * Math.sin(angle), y: -r * Math.cos(angle) });
          }
          for (let n = 0; n < pts.length; n++) {
            if (dts(localPos, pts[n], pts[(n+1) % pts.length]) < threshold) { isHit = true; break; }
          }
        } else if (el.type === 'star') {
          const r1 = el.outerRadius || 0, r2 = el.innerRadius || 0;
          const pts = [];
          for (let n = 0; n < 10; n++) {
            const r = n % 2 === 0 ? r1 : r2;
            const angle = (n * Math.PI) / 5;
            pts.push({ x: r * Math.sin(angle), y: -r * Math.cos(angle) });
          }
          for (let n = 0; n < pts.length; n++) {
            if (dts(localPos, pts[n], pts[(n+1) % pts.length]) < threshold) { isHit = true; break; }
          }
        } else if (el.type === 'text') {
          if (localPos.x >= -baseThreshold && localPos.x <= (el.width || 100) + baseThreshold && localPos.y >= -baseThreshold && localPos.y <= (el.fontSize || 20) + baseThreshold) isHit = true;
        }

        if (isHit) {
          setElementsToDelete(new Set([el.id]));
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
      const baseThreshold = 3; 
      
      const dts = (p, v, w) => {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
      };

      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (elementsToDelete.has(el.id)) continue;

        let isHit = false;
        const ex = el.x || 0;
        const ey = el.y || 0;
        const localPos = { x: pos.x - ex, y: pos.y - ey };
        
        // Account for visual thickness of the stroke
        const sw = el.strokeWidth || 2;
        const threshold = baseThreshold + sw / 2;

        if (el.type === 'pencil' || el.type === 'line' || el.type === 'arrow') {
          if (el.points) {
            for (let j = 0; j < el.points.length - 2; j += 2) {
              const p1 = { x: el.points[j], y: el.points[j+1] };
              const p2 = { x: el.points[j+2], y: el.points[j+3] };
              if (dts(localPos, p1, p2) < threshold) { isHit = true; break; }
            }
          }
        } else if (el.type === 'rect') {
          const w = el.width || 0, h = el.height || 0;
          if (dts(localPos, {x:0, y:0}, {x:w, y:0}) < threshold || dts(localPos, {x:w, y:0}, {x:w, y:h}) < threshold ||
              dts(localPos, {x:w, y:h}, {x:0, y:h}) < threshold || dts(localPos, {x:0, y:h}, {x:0, y:0}) < threshold) isHit = true;
        } else if (el.type === 'circle') {
          const dist = Math.sqrt(Math.pow(localPos.x, 2) + Math.pow(localPos.y, 2));
          if (Math.abs(dist - (el.radius || 0)) < threshold) isHit = true;
        } else if (['triangle', 'diamond', 'pentagon', 'hexagon'].includes(el.type)) {
          const r = el.radius || 0;
          const sides = el.type === 'triangle' ? 3 : (el.type === 'diamond' ? 4 : (el.type === 'pentagon' ? 5 : 6));
          const pts = [];
          for (let n = 0; n < sides; n++) {
            const angle = (n * 2 * Math.PI) / sides;
            pts.push({ x: r * Math.sin(angle), y: -r * Math.cos(angle) });
          }
          for (let n = 0; n < pts.length; n++) {
            if (dts(localPos, pts[n], pts[(n+1) % pts.length]) < threshold) { isHit = true; break; }
          }
        } else if (el.type === 'star') {
          const r1 = el.outerRadius || 0, r2 = el.innerRadius || 0;
          const pts = [];
          for (let n = 0; n < 10; n++) {
            const r = n % 2 === 0 ? r1 : r2;
            const angle = (n * Math.PI) / 5;
            pts.push({ x: r * Math.sin(angle), y: -r * Math.cos(angle) });
          }
          for (let n = 0; n < pts.length; n++) {
            if (dts(localPos, pts[n], pts[(n+1) % pts.length]) < threshold) { isHit = true; break; }
          }
        } else if (el.type === 'text') {
          if (localPos.x >= -baseThreshold && localPos.x <= (el.width || 100) + baseThreshold && localPos.y >= -baseThreshold && localPos.y <= (el.fontSize || 20) + baseThreshold) isHit = true;
        }

        if (isHit) {
          setElementsToDelete(prev => {
            const next = new Set(prev);
            next.add(el.id);
            return next;
          });
          break;
        }
      }
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

    if (tool === 'eraser' && isDrawing) {
      if (elementsToDelete.size > 0) {
        const remainingElements = elements.filter(el => !elementsToDelete.has(el.id));
        setElements(remainingElements, true);
      }
      setEraserPath(null);
      setElementsToDelete(new Set());
    }

    if (tool === 'precision-eraser' && isDrawing) {
      setEraserPath(null);
      // We don't need elementsToDelete for precision eraser as it's real-time,
      // but we should commit the final state to history here.
      setElements([...elements], true); 
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentElement) {
      const finalElement = { ...currentElement };
      if (finalElement.type === 'pencil' && finalElement.points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < finalElement.points.length; i += 2) {
          const x = finalElement.points[i];
          const y = finalElement.points[i + 1];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        finalElement.bbox = { minX, minY, maxX, maxY };
      }
      setElements([...elements, finalElement], true);
      setCurrentElement(null);
    }
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
      if (textInput.id && elements.find(el => el.id === textInput.id)) {
        const updatedElements = elements.map(e =>
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
        setElements(updatedElements, true);
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
        setElements([...elements, newElement], true);
      }
    } else if (textInput && textInput.id) {
      const updatedElements = elements.filter(e => e.id !== textInput.id);
      setElements(updatedElements, true);
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
    handleDragMove(e); // Ensure final position is set
    setElements(elements, true); // Add final state to history
    setChildElements([]);
  };

  const handleTransformEnd = (e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to 1 to avoid double scaling visually
    node.scaleX(1);
    node.scaleY(1);

    const updatedElements = elements.map(el => {
      if (el.id === node.id()) {
        return {
          ...el,
          x: node.x(),
          y: node.y(),
          width: el.width ? Math.max(5, el.width * scaleX) : undefined,
          height: el.height ? Math.max(5, el.height * scaleY) : undefined,
          radius: el.radius ? Math.max(5, el.radius * scaleX) : undefined,
          innerRadius: el.innerRadius ? Math.max(2, el.innerRadius * scaleX) : undefined,
          outerRadius: el.outerRadius ? Math.max(5, el.outerRadius * scaleX) : undefined,
        };
      }
      return el;
    });
    setElements(updatedElements, true);
  };

  const renderElement = (el) => {
    const isMarkedForDeletion = elementsToDelete.has(el.id);
    
    const commonProps = {
      id: el.id,
      key: el.id,
      draggable: tool === 'select' || ctrlPressed,
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onTransformEnd: handleTransformEnd,
      opacity: isMarkedForDeletion ? 0.3 : 1,
      stroke: isMarkedForDeletion ? '#ff4d4d' : undefined, // Override stroke if marked
    };

    switch (el.type) {
      case 'pencil':
        if (!el.points || el.points.length < 2) return null;
        return <Line {...commonProps} points={el.points} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" x={el.x || 0} y={el.y || 0} />;
      case 'line':
        return <Line {...commonProps} points={el.points} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} x={el.x || 0} y={el.y || 0} />;
      case 'arrow':
        return <Arrow {...commonProps} points={el.points} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} fill={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} x={el.x || 0} y={el.y || 0} />;
      case 'rect':
        return <Rect {...commonProps} x={el.x} y={el.y} width={el.width} height={el.height} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'circle':
        return <Circle {...commonProps} x={el.x} y={el.y} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'triangle':
        return <RegularPolygon {...commonProps} x={el.x} y={el.y} sides={3} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'diamond':
        return <RegularPolygon {...commonProps} x={el.x} y={el.y} sides={4} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'pentagon':
        return <RegularPolygon {...commonProps} x={el.x} y={el.y} sides={5} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'hexagon':
        return <RegularPolygon {...commonProps} x={el.x} y={el.y} sides={6} radius={el.radius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'star':
        return <Star {...commonProps} x={el.x} y={el.y} numPoints={5} innerRadius={el.innerRadius} outerRadius={el.outerRadius} stroke={isMarkedForDeletion ? '#ff4d4d' : el.stroke} strokeWidth={el.strokeWidth} fill={isMarkedForDeletion ? '#ff4d4d33' : el.fill} />;
      case 'text':
        return (
          <Text
            {...commonProps}
            x={el.x}
            y={el.y}
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
        cursor: tool === 'select' ? 'default' : (tool === 'text' ? 'text' : 'crosshair'),
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
