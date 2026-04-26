import React, { useRef, useState, useEffect } from 'react';
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

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const textareaRef = useRef(null);

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

  const handleMouseDown = (e) => {
    if (textInput) {
      // If clicking while typing, finish text input
      handleTextareaBlur();
      return;
    }

    if (e.evt.button === 1 || e.evt.button === 2) return; // middle/right click for panning

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

      setTextInput({
        x: pos.x,
        y: pos.y,
        screenX: e.evt.clientX,
        screenY: e.evt.clientY,
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

  const handleMouseMove = (e) => {
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

  const handleMouseUp = () => {
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
        return <Text {...commonProps} x={el.x} y={el.y} text={el.text} width={el.width} fill={el.fill} fontSize={20} fontFamily="sans-serif" onDblClick={(e) => handleTextDblClick(e, el)} visible={!textInput || textInput.id !== el.id} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative', backgroundColor: '#1A1A1A', width: '100vw', height: '100vh', overflow: 'hidden', cursor: tool === 'select' ? 'default' : (tool === 'text' ? 'text' : 'crosshair') }}>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
