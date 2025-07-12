import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import "./App.css";

const ai = new GoogleGenAI({ apiKey: "AIzaSyBV8oBUazMLXq776NhJAUGtrSsZ1dV_bLc" });

export default function ChatbotInstance({
  id,
  name = "Chatbot",
  initialQuestion = "",
  onRemove,
  onRename,
  onMove,
  onFollowUp,
  isMain = false,
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const recognitionRef = useRef(null);

  // Add state and handlers for custom audio player at the top of the component
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(1);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const audioElemRef = useRef(null);
  const [audioLoading, setAudioLoading] = useState(false);

  const toggleAudioPlay = () => {
    const audio = audioElemRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };
  const handleSeek = (e) => {
    const audio = audioElemRef.current;
    if (!audio) return;
    audio.currentTime = e.target.value;
    setAudioTime(Number(e.target.value));
  };
  const handleVolume = (e) => {
    const audio = audioElemRef.current;
    if (!audio) return;
    audio.volume = e.target.value;
    setAudioVolume(Number(e.target.value));
  };
  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'chatbot-answer.webm';
    a.click();
  };
  useEffect(() => {
    if (audioUrl) {
      setAutoPlayAudio(true);
      setIsPlaying(true);
      setAudioTime(0);
    } else {
      setIsPlaying(false);
      setAudioTime(0);
      setAudioDuration(0);
    }
  }, [audioUrl]);

  const browserSupportsSpeechRecognition =
    "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (initialQuestion && !answer) {
      handleAsk();
    }
    // eslint-disable-next-line
  }, []);

  // Voice input handler
  const handleVoiceInput = () => {
    if (!browserSupportsSpeechRecognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    setError("");
    setListening(true);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      setListening(false);
    };

    recognition.onerror = (event) => {
      setError("Voice input error: " + event.error + ". Try refreshing and allowing microphone access.");
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognition.start();
  };

  // Stop voice input if needed
  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  // Ask Gemini!
  const handleAsk = async (e) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAudioUrl(null);
    setAudioLoading(false);
    // Add question to history with loading answer
    const qIdx = history.length;
    setHistory((prev) => [...prev, { question, answer: null, audioUrl: null }]);
    setQuestion("");
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: question,
      });
      setHistory((prev) => prev.map((item, i) => i === qIdx ? { ...item, answer: response.text || "No answer received." } : item));
    } catch (err) {
      setError("Failed to get answer. Please try again.");
      setHistory((prev) => prev.map((item, i) => i === qIdx ? { ...item, answer: "[Error: Failed to get answer]" } : item));
    }
    setLoading(false);
  };

  // Generate audio from answer using SpeechSynthesis and record to a Blob
  const handleListen = async (idx) => {
    const entry = history[idx];
    if (!entry || !entry.answer) return;
    setAudioUrl(null);
    setAudioLoading(true);
    // Check for browser support
    if (!window.speechSynthesis || !window.MediaRecorder) {
      setError("Audio playback is not supported in this browser.");
      setAudioLoading(false);
      return;
    }
    // Create a new utterance
    const utter = new window.SpeechSynthesisUtterance(entry.answer);
    utter.lang = "en-US";
    // Create a MediaStream destination
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    // Patch speechSynthesis to output to the destination
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0) utter.voice = voices[0];
    // Create a new MediaRecorder
    const recorder = new window.MediaRecorder(dest.stream);
    let chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioLoading(false);
      setHistory((prev) => prev.map((item, i) => i === idx ? { ...item, audioUrl: url } : item));
      audioCtx.close();
    };
    // Connect speech synthesis to the destination
    const source = audioCtx.createMediaStreamSource(dest.stream);
    source.connect(audioCtx.destination);
    // Start recording
    recorder.start();
    // Speak the utterance
    synth.speak(utter);
    utter.onend = () => {
      recorder.stop();
    };
  };

  // Follow-up: select text in answer and ask again
  const handleFollowUp = (text) => {
    setQuestion(text);
  };

  // Drag and drop (for mini only)
  const handleDrag = (e) => {
    if (!onMove) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = e.currentTarget.parentElement.getBoundingClientRect();
    const origX = orig.left;
    const origY = orig.top;
    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      onMove(origX + dx, origY + dy);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className={`chatbot-instance${isMain ? " main" : " mini"}`}> 
      <div className="chatbot-header" onMouseDown={!isMain && onMove ? handleDrag : undefined}>
        {editingName ? (
          <input
            className="chatbot-rename-input"
            value={name}
            onChange={(e) => onRename && onRename(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            autoFocus
          />
        ) : (
          <span className="chatbot-title" onDoubleClick={() => setEditingName(true)}>{name}</span>
        )}
        {!isMain && (
          <button className="chatbot-remove-btn" onClick={onRemove} title="Remove">×</button>
        )}
      </div>
      <form onSubmit={handleAsk} className="qa-form">
        <div className="input-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question…"
            className="input"
            disabled={loading || listening}
            autoFocus={isMain}
            required
          />
          <button
            type="button"
            className={`mic-btn${listening ? " listening" : ""}`}
            onClick={listening ? stopVoiceInput : handleVoiceInput}
            aria-label="Voice input"
            disabled={loading}
            title="Ask by voice"
            style={{ flex: 'none' }}
          >
            {listening ? (
              <span className="mic-anim"></span>
            ) : (
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="var(--primary-dark)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            )}
          </button>
        </div>
        <button
          type="submit"
          className="ask-btn"
          disabled={loading || !question}
        >
          {loading ? <span><span className="spinner"></span> Asking…</span> : "Ask"}
        </button>
      </form>
      <div className="card-content">
        {!browserSupportsSpeechRecognition && (
          <div className="error" style={{ marginTop: 10 }}>
            Voice input is not supported in this browser.
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="qa-history">
          {history.map((item, idx) => (
            <div className="qa-history-entry" key={idx} style={{marginBottom: '1.2em', paddingBottom: '0.7em', borderBottom: '1px solid #e5e7eb'}}>
              <div className="qa-question" style={{fontWeight: 'bold', marginBottom: '0.3em'}}>Q: {item.question}</div>
              <div className="qa-answer" style={{marginLeft: '0.5em'}}>
                <span>A: {item.answer ? (
                  Array.isArray(item.answer)
                    ? item.answer.map((para, i) => <p key={i} style={{margin:0,marginBottom:'0.5em'}}>{para}</p>)
                    : item.answer.split(/\n{2,}|\n/).map((para, i) => <p key={i} style={{margin:0,marginBottom:'0.5em'}}>{para}</p>)
                ) : <span className="spinner" style={{width:'1.2em',height:'1.2em',verticalAlign:'middle'}}></span>}</span>
                {item.answer && (
                  <button className="listen-btn" onClick={() => handleListen(idx)} disabled={audioLoading && audioUrl === null} style={{marginLeft:8}}>
                    🔊 Listen
                  </button>
                )}
              </div>
              {/* Show audio player for this entry if audioUrl matches */}
              {item.audioUrl && audioUrl === item.audioUrl && (
                <div className={`custom-audio-player${audioLoading ? ' loading' : ''}`}>
                  <audio
                    src={item.audioUrl}
                    ref={audioElemRef}
                    controls={false}
                    onTimeUpdate={e => setAudioTime(e.target.currentTime)}
                    onLoadedMetadata={e => setAudioDuration(e.target.duration)}
                    onEnded={() => setIsPlaying(false)}
                    autoPlay={autoPlayAudio}
                    volume={audioVolume}
                  />
                  <button className="audio-play-btn" onClick={toggleAudioPlay} type="button" disabled={audioLoading} tabIndex={audioLoading ? -1 : 0}>
                    {isPlaying ? (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="4" width="4" height="14" rx="2" fill="#fff"/><rect x="14" y="4" width="4" height="14" rx="2" fill="#fff"/></svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polygon points="5,4 19,11 5,18" fill="#fff"/></svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max={audioDuration || 1}
                    step="0.01"
                    value={audioTime}
                    onChange={handleSeek}
                    className="audio-seek"
                    disabled={audioLoading}
                    tabIndex={audioLoading ? -1 : 0}
                  />
                  <span className="audio-time">{formatTime(audioTime)} / {formatTime(audioDuration)}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={audioVolume}
                    onChange={handleVolume}
                    className="audio-volume"
                    disabled={audioLoading}
                    tabIndex={audioLoading ? -1 : 0}
                  />
                  <button className="audio-download-btn" onClick={downloadAudio} title="Download" type="button" disabled={audioLoading} tabIndex={audioLoading ? -1 : 0}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10m0 0l-4-4m4 4l4-4M4 17h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {audioLoading && (
                    <div className="audio-loading-spinner" style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'rgba(248,250,252,0.85)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'inherit',zIndex:2}}>
                      <span className="spinner"></span> Generating audio…
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {loading && !answer && (
          <div className="answer-block" style={{ textAlign: 'center', minHeight: 60 }}>
            <span className="spinner" style={{ width: '2em', height: '2em' }}></span>
          </div>
        )}
        {answer && (
          <div className="answer-block">
            <div className="answer-listen-bar">
              <button
                className="listen-btn"
                onClick={handleListen}
              >
                🔊 Listen
              </button>
            </div>
            {(audioLoading || audioUrl) && (
              <div className={`custom-audio-player${audioLoading ? ' loading' : ''}`}>
                <audio
                  src={audioUrl || undefined}
                  ref={audioElemRef}
                  controls={false}
                  onTimeUpdate={e => setAudioTime(e.target.currentTime)}
                  onLoadedMetadata={e => setAudioDuration(e.target.duration)}
                  onEnded={() => setIsPlaying(false)}
                  autoPlay={autoPlayAudio}
                  volume={audioVolume}
                />
                <button className="audio-play-btn" onClick={toggleAudioPlay} type="button" disabled={audioLoading} tabIndex={audioLoading ? -1 : 0}>
                  {isPlaying ? (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="4" width="4" height="14" rx="2" fill="#fff"/><rect x="14" y="4" width="4" height="14" rx="2" fill="#fff"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polygon points="5,4 19,11 5,18" fill="#fff"/></svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 1}
                  step="0.01"
                  value={audioTime}
                  onChange={handleSeek}
                  className="audio-seek"
                  disabled={audioLoading}
                  tabIndex={audioLoading ? -1 : 0}
                />
                <span className="audio-time">{formatTime(audioTime)} / {formatTime(audioDuration)}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audioVolume}
                  onChange={handleVolume}
                  className="audio-volume"
                  disabled={audioLoading}
                  tabIndex={audioLoading ? -1 : 0}
                />
                <button className="audio-download-btn" onClick={downloadAudio} title="Download" type="button" disabled={audioLoading} tabIndex={audioLoading ? -1 : 0}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10m0 0l-4-4m4 4l4-4M4 17h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {audioLoading && (
                  <div className="audio-loading-spinner" style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'rgba(248,250,252,0.85)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'inherit',zIndex:2}}>
                    <span className="spinner"></span> Generating audio…
                  </div>
                )}
              </div>
            )}
            <div className="answer-label">Answer:</div>
            <div className="answer selectable-answer">{answer}</div>
          </div>
        )}
      </div>
    </div>
  );
} 