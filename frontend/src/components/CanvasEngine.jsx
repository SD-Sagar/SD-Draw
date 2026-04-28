import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle, Arrow, Text, Transformer } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import useCanvasStore from '../store/useCanvasStore';

const CanvasEngine = () => {
  const { elements, setElements, tool, strokeColor, strokeWidth, fillColor, undo, redo } = useCanvasStore();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState(null);
  const [textInput, setTextInput] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [lastPinchDist, setLastPinchDist] = useState(null);

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

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
      e.preventDefault();
    };

    container.addEventListener('touchstart', preventTouch, { passive: false });
    container.addEventListener('touchmove', preventTouch, { passive: false });
    container.addEventListener('touchend', preventTouch, { passive: false });

    return () => {
      container.removeEventListener('touchstart', preventTouch);
      container.removeEventListener('touchmove', preventTouch);
      container.removeEventListener('touchend', preventTouch);
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, elements, selectedId, setElements]);

  // Update Transformer when selection or tool changes
  useEffect(() => {
    if (selectedId && tool === 'select') {
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

  // Unified pointer-down handler (works for both mouse and touch)
  const handlePointerDown = (e) => {
    if (textInput) {
      handleTextareaBlur();
      return;
    }

    const evt = e.evt;
    // For mouse: skip middle/right click
    if (evt.button === 1 || evt.button === 2) return;

    // For touch: if two fingers, start pinch — don't draw
    if (evt.touches && evt.touches.length === 2) {
      setLastPinchDist(getTouchDist(evt.touches));
      return;
    }

    const stage = stageRef.current;
    const pos = getRelativePointerPosition(stage);

    if (tool === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        setSelectedId(null);
      } else {
        const id = e.target.id();
        if (id) setSelectedId(id);
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

    // Deselect if switching to drawing tool
    setSelectedId(null);
    setIsDrawing(true);

    const newElement = {
      id: uuidv4(),
      type: tool,
      stroke: strokeColor,
      strokeWidth,
      fill: fillColor,
    };

    if (tool === 'pencil' || tool === 'eraser') {
      newElement.points = [pos.x, pos.y];
      if (tool === 'eraser') {
        newElement.stroke = '#1A1A1A'; // Erase by matching bg color
        newElement.strokeWidth = strokeWidth * 5; // Erase thicker
      }
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
    }

    setCurrentElement(newElement);
  };

  // Unified pointer-move handler
  const handlePointerMove = (e) => {
    const evt = e.evt;

    // Handle pinch-to-zoom with two fingers
    if (evt.touches && evt.touches.length === 2) {
      e.evt.preventDefault();
      const newDist = getTouchDist(evt.touches);
      if (lastPinchDist) {
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const scaleChange = newDist / lastPinchDist;
        const newScale = oldScale * scaleChange;

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

    if (!isDrawing || !currentElement) return;

    const stage = stageRef.current;
    const pos = getRelativePointerPosition(stage);

    const updatedElement = { ...currentElement };

    if (tool === 'pencil' || tool === 'eraser') {
      updatedElement.points = [...updatedElement.points, pos.x, pos.y];
    } else if (tool === 'line' || tool === 'arrow') {
      updatedElement.points = [updatedElement.points[0], updatedElement.points[1], pos.x, pos.y];
    } else if (tool === 'rect') {
      updatedElement.width = pos.x - updatedElement.x;
      updatedElement.height = pos.y - updatedElement.y;
    } else if (tool === 'circle') {
      const dx = pos.x - updatedElement.x;
      const dy = pos.y - updatedElement.y;
      updatedElement.radius = Math.sqrt(dx * dx + dy * dy);
    }

    setCurrentElement(updatedElement);
  };

  // Unified pointer-up handler
  const handlePointerUp = () => {
    // Reset pinch state
    setLastPinchDist(null);

    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentElement) {
      setElements([...elements, currentElement], true);
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
          e.id === textInput.id ? { ...e, text: textInput.value, width } : e
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

  const handleDragEnd = (e) => {
    const id = e.target.id();
    const updatedElements = elements.map(el => {
      if (el.id === id) {
        return {
          ...el,
          x: e.target.x(),
          y: e.target.y()
        };
      }
      return el;
    });
    setElements(updatedElements, true);
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
        };
      }
      return el;
    });
    setElements(updatedElements, true);
  };

  const renderElement = (el) => {
    const commonProps = {
      id: el.id,
      key: el.id,
      draggable: tool === 'select',
      onDragEnd: handleDragEnd,
      onTransformEnd: handleTransformEnd
    };

    switch (el.type) {
      case 'pencil':
      case 'eraser':
        return <Line {...commonProps} points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" x={el.x || 0} y={el.y || 0} />;
      case 'line':
        return <Line {...commonProps} points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth} x={el.x || 0} y={el.y || 0} />;
      case 'arrow':
        return <Arrow {...commonProps} points={el.points} stroke={el.stroke} fill={el.stroke} strokeWidth={el.strokeWidth} x={el.x || 0} y={el.y || 0} />;
      case 'rect':
        return <Rect {...commonProps} x={el.x} y={el.y} width={el.width} height={el.height} stroke={el.stroke} strokeWidth={el.strokeWidth} fill={el.fill} />;
      case 'circle':
        return <Circle {...commonProps} x={el.x} y={el.y} radius={el.radius} stroke={el.stroke} strokeWidth={el.strokeWidth} fill={el.fill} />;
      case 'text':
        return <Text {...commonProps} x={el.x} y={el.y} text={el.text} width={el.width} fill={el.fill} fontSize={20} fontFamily="sans-serif" onDblClick={(e) => handleTextDblClick(e, el)} onDblTap={(e) => handleTextDblClick(e, el)} visible={!textInput || textInput.id !== el.id} />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        backgroundColor: '#1A1A1A',
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
        draggable={tool === 'select' && !selectedId} // Can drag canvas if select tool is on and no object is selected
        ref={stageRef}
      >
        <Layer>
          {elements.map(renderElement)}
          {currentElement && renderElement(currentElement)}
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
            fontSize: `${20 * scale}px`,
            fontFamily: 'sans-serif',
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
