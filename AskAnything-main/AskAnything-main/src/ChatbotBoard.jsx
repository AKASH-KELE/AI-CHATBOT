import React, { useState, useRef } from "react";
import ChatbotInstance from "./ChatbotInstance";
import Draggable from "react-draggable";
import "./App.css";

// Unique ID generator for instances
const generateId = (() => {
  let id = 0;
  return () => ++id;
})();

export default function ChatbotBoard() {
  // The main instance is always present
  const [miniInstances, setMiniInstances] = useState([]);
  // Store nodeRefs for each mini instance by id
  const nodeRefs = useRef({});

  // Add a new mini instance
  const addMiniInstance = (initialQuestion = "") => {
    setMiniInstances((prev) => [
      ...prev,
      {
        id: generateId(),
        name: `Mini Chatbot ${prev.length + 1}`,
        initialQuestion,
        position: { x: 100 + prev.length * 40, y: 100 + prev.length * 40 },
      },
    ]);
  };

  // Remove a mini instance
  const removeMiniInstance = (id) => {
    setMiniInstances((prev) => prev.filter((inst) => inst.id !== id));
    delete nodeRefs.current[id];
  };

  // Rename a mini instance
  const renameMiniInstance = (id, newName) => {
    setMiniInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, name: newName } : inst))
    );
  };

  // Move a mini instance (for drag & drop)
  const moveMiniInstance = (id, x, y) => {
    setMiniInstances((prev) =>
      prev.map((inst) =>
        inst.id === id ? { ...inst, position: { x, y } } : inst
      )
    );
  };

  return (
    <div className="chatbot-board">
      {/* Main full-screen chatbot instance */}
      <div className="main-chatbot-instance">
        <ChatbotInstance
          isMain
          onFollowUp={addMiniInstance}
          name="Main Chatbot"
        />
      </div>
      {/* Mini chatbot instances */}
      {miniInstances.map((inst) => {
        if (!nodeRefs.current[inst.id]) nodeRefs.current[inst.id] = React.createRef();
        const nodeRef = nodeRefs.current[inst.id];
        return (
          <Draggable
            key={inst.id}
            handle=".chatbot-header"
            defaultPosition={inst.position}
            position={inst.position}
            onStop={(_, data) => moveMiniInstance(inst.id, data.x, data.y)}
            nodeRef={nodeRef}
          >
            <div
              ref={nodeRef}
              className="mini-chatbot-instance"
              style={{
                zIndex: 10 + inst.id,
              }}
            >
              <ChatbotInstance
                id={inst.id}
                name={inst.name}
                initialQuestion={inst.initialQuestion}
                onRemove={() => removeMiniInstance(inst.id)}
                onRename={(newName) => renameMiniInstance(inst.id, newName)}
                onMove={(x, y) => moveMiniInstance(inst.id, x, y)}
                onFollowUp={addMiniInstance}
              />
            </div>
          </Draggable>
        );
      })}
      {/* Add mini instance button */}
      <button className="add-mini-btn" onClick={() => addMiniInstance()} aria-label="Add new mini chatbot">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{display:'block',margin:'auto'}}>
          <circle cx="16" cy="16" r="16" fill="var(--primary)" />
          <rect x="14" y="8" width="4" height="16" rx="2" fill="#fff" />
          <rect x="8" y="14" width="16" height="4" rx="2" fill="#fff" />
        </svg>
      </button>
    </div>
  );
} 