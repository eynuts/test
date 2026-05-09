import { useState, useEffect, useRef, useCallback } from 'react'
import { Plane, CloudSun, Luggage, Settings, Camera, HeartPulse, Globe, MapPin, X } from 'lucide-react'
import { generateContent } from '../api/gemini'
import './home.css'
import Sphere3D from './Sphere3D'

const GlassCard = ({ icon, children, isCenter = false, onClick }) => {
  return (
    <div className={`glass-card ${isCenter ? 'card-centered' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="card-icon">{icon}</div>
      <div className="card-content">
        {children}
      </div>
    </div>
  )
}

export default function Home() {
  const [activeModal, setActiveModal] = useState(null)
  const [subtitle, setSubtitle] = useState('')
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isDetectingSpeech, setIsDetectingSpeech] = useState(false)
  const [isAwake, setIsAwake] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [textInput, setTextInput] = useState('')
  const recognitionRef = useRef(null)
  const subtitleTimeoutRef = useRef(null)
  const isListeningRef = useRef(false)
  const isProcessingRef = useRef(false)
  const isAwakeRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const lastErrorTimeRef = useRef(0)
  const restartCountRef = useRef(0)
  const lastRestartTimeRef = useRef(0)
  const restartTimerRef = useRef(null)
  
  const timeDate = new Date()
  const hours = String(timeDate.getHours()).padStart(2, '0')
  const minutes = String(timeDate.getMinutes()).padStart(2, '0')
  const seconds = String(timeDate.getSeconds()).padStart(2, '0')
  const formattedDate = timeDate.toLocaleDateString('en-US', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }).toUpperCase()

  // Sync refs with state
  useEffect(() => {
    isListeningRef.current = isListening
    console.log('isListening state updated:', isListening)
  }, [isListening])

  useEffect(() => {
    isProcessingRef.current = isProcessing
  }, [isProcessing])

  useEffect(() => {
    isAwakeRef.current = isAwake
  }, [isAwake])

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      
      isSpeakingRef.current = true
      setIsSpeaking(true)
      setIsDetectingSpeech(false)
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1
      utterance.lang = 'en-US'
      
      utterance.onend = () => {
        setTimeout(() => {
          isSpeakingRef.current = false
          setIsSpeaking(false)
        }, 1500) // Increase delay slightly to 1.5s to ensure no echoes slip through
      }
      
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error)
        isSpeakingRef.current = false
        setIsSpeaking(false)
      }
      
      window.speechSynthesis.speak(utterance)
    } else {
      console.error('Speech Synthesis not supported')
    }
  }

  const showSubtitle = (text) => {
    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current)
    }
    setSubtitle(text)
    speakText(text)
    subtitleTimeoutRef.current = setTimeout(() => {
      setSubtitle('')
    }, 10000)
  }

  const callGemini = useCallback(async (text) => {
    if (!text.trim()) return
    isProcessingRef.current = true
    setIsThinking(true)
    setIsProcessing(true)
    try {
      const response = await generateContent(`You are Alvi, a helpful AI assistant. Keep responses concise (under 50 words). User says: ${text}`)
      showSubtitle(response || 'No response')
    } catch (error) {
      showSubtitle('Error: ' + error.message)
    } finally {
      setIsThinking(false)
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }, [])

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.maxAlternatives = 1

      recognitionRef.current.onstart = () => {
        console.log('🎤 Recognition started - listening for speech')
      }

      recognitionRef.current.onresult = (event) => {
        // Drop any audio picked up while AI is speaking or processing
        if (isSpeakingRef.current || isProcessingRef.current) return
        
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim()
          
          // Show interim results
          if (!event.results[i].isFinal) {
            setSubtitle('') // clear any old AI subtitle so user's transcript shows
            interimTranscript += transcript + ' '
            setIsDetectingSpeech(true)
            setCurrentTranscript(interimTranscript.trim())
          } else {
            // Final result
            setIsDetectingSpeech(false)
            setCurrentTranscript('')
            console.log('✓ Final transcript:', transcript)
            restartCountRef.current = 0 // Reset backoff — speech was captured successfully
            
            // Check for wake-up phrases
            const isWakeWord = transcript.includes('alvi') || transcript.includes('albi') || transcript.includes('alby')
            
            if (!isAwakeRef.current && isWakeWord) {
              setIsAwake(true)
              isAwakeRef.current = true
              showSubtitle('Alvi here! How can I help you?')
              return
            }
            
            if (isAwakeRef.current && transcript) {
              setIsProcessing(true)
              isProcessingRef.current = true
              
              // Remove wake words and punctuation from the command
              const cleanedTranscript = transcript
                .replace(/alvi/gi, '')
                .replace(/albi/gi, '')
                .replace(/alby/gi, '')
                .replace(/hi /gi, '')
                .replace(/hey /gi, '')
                .replace(/[.,!?]/g, '')
                .trim()
              
              if (cleanedTranscript) {
                callGemini(cleanedTranscript)
              } else {
                setIsProcessing(false)
                isProcessingRef.current = false
                showSubtitle('Yes? What do you need?')
              }
              return
            }
          }
        }
      }

      recognitionRef.current.onerror = (event) => {
        if (event.error !== 'network') {
          console.error('❌ Speech recognition error:', event.error)
        }
        setIsDetectingSpeech(false)
        if (event.error === 'network') {
          lastErrorTimeRef.current = Date.now()
        }
      }

      recognitionRef.current.onend = () => {
        setIsDetectingSpeech(false)

        if (!isListeningRef.current || isSpeakingRef.current || isProcessingRef.current) return

        // Clear any pending restart
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)

        // Track how fast we are restarting
        const now = Date.now()
        const timeSinceLastRestart = now - lastRestartTimeRef.current
        if (timeSinceLastRestart < 3000) {
          // Restarting too fast — increment counter
          restartCountRef.current = Math.min(restartCountRef.current + 1, 8)
        } else {
          // Long gap since last restart — reset counter
          restartCountRef.current = 0
        }
        lastRestartTimeRef.current = now

        // Exponential backoff: 300ms, 600ms, 1200ms, 2400ms... capped at 8s
        const delay = Math.min(300 * Math.pow(2, restartCountRef.current), 8000)
        console.log(`⟳ Restarting recognition in ${delay}ms (attempt ${restartCountRef.current})`)

        restartTimerRef.current = setTimeout(() => {
          try {
            if (recognitionRef.current && isListeningRef.current && !isSpeakingRef.current) {
              recognitionRef.current.start()
            }
          } catch (error) {
            console.error('Error restarting:', error)
          }
        }, delay)
      }
    } else {
      console.error('❌ Speech Recognition API not supported in this browser')
    }

    return () => {
      isListeningRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (error) {
          console.error('Error aborting recognition:', error)
        }
      }
    }
  }, [])

  const startListening = () => {
    if (recognitionRef.current) {
      console.log('Attempting to start listening...')
      isListeningRef.current = true
      setIsListening(true)
      try {
        recognitionRef.current.start()
        console.log('🎤 Started listening')
        
        // Just show text, don't speak it to avoid breaking the mic connection
        if (subtitleTimeoutRef.current) {
          clearTimeout(subtitleTimeoutRef.current)
        }
        setSubtitle('Listening... say "hi alvi" to wake me up')
        subtitleTimeoutRef.current = setTimeout(() => {
          setSubtitle('')
        }, 5000)
      } catch (error) {
        console.error('Error starting recognition:', error)
        isListeningRef.current = false
        setIsListening(false)
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      console.log('Stopping listening...')
      isListeningRef.current = false
      setIsListening(false)
      try {
        recognitionRef.current.abort()
      } catch (error) {
        console.error('Error stopping:', error)
      }
      setIsDetectingSpeech(false)
      setIsAwake(false)
      isAwakeRef.current = false
      setCurrentTranscript('')
    }
  }

  const handleTextSubmit = (e) => {
    e.preventDefault()
    const text = textInput.trim()
    if (!text) return
    if (!isAwake && text.toLowerCase().includes('alvi')) {
      setIsAwake(true)
      showSubtitle('Alvi here! How can I help you?')
    } else if (isAwake) {
      callGemini(text)
    }
    setTextInput('')
  }

  const getModalContent = () => {
    switch(activeModal) {
      case 'FLIGHT': return 'Flight SFX 104 is on schedule. Boarding begins in 45 minutes at Gate B4.'
      case 'WEATHER': return 'Current temperature in Moscow is 22°C with partly cloudy skies. Wind 12km/h.'
      case 'LUGGAGE': return 'Checked baggage weight: 18KG. Status: Loaded on aircraft.'
      case 'TRANSLATE': return 'Translation active: Spanish to English. Speak to translate.'
      case 'NAVIGATION': return 'Destination is 550KM away. Estimated time of arrival: 6H 20M.'
      case 'SETTINGS': return 'System preferences, display settings, and user profiles.'
      case 'LOCAL TIPS': return 'Discover the Art District, best city views, and local cuisine recommendations.'
      case 'HEALTH STATS': return 'Heart rate: 72 BPM. Oxygen saturation: 98%. Overall health: OK.'
      default: return 'Loading details...'
    }
  }

  return (
    <div className="home-container">
      {/* 3D Background */}
      <div className="center-sphere">
        <Sphere3D isSpeaking={isSpeaking} />
        {isDetectingSpeech && (
          <div className="listening-indicator">
            <div className="listening-ring ring-1"></div>
            <div className="listening-ring ring-2"></div>
            <div className="listening-ring ring-3"></div>
          </div>
        )}
        {isThinking && (
          <div className="thinking-indicator">
            <div className="thinking-dot"></div>
            <div className="thinking-dot"></div>
            <div className="thinking-dot"></div>
            <div className="thinking-text">THINKING</div>
          </div>
        )}
      </div>

      {/* Top Header */}
      <div className="header-display">
        <div className="time">{hours}:{minutes}:{seconds}</div>
        <div className="date">{formattedDate}</div>
        <div className="location">MOSCOW</div>
      </div>

      {/* Dashboard Overlay */}
      <div className="dashboard-overlay">
        
        {/* Left Column */}
        <div className="side-column left">
          <GlassCard icon={<Plane size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('FLIGHT')}>
            <div className="card-title">FLIGHT</div>
            <div className="card-sub">SFX 104</div>
            <div className="card-sub">6H 20M</div>
          </GlassCard>

          <GlassCard icon={<CloudSun size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('WEATHER')}>
            <div className="card-title">WEATHER</div>
            <div className="card-value">22°C</div>
            <div className="card-sub">MOSCOW</div>
          </GlassCard>

          <GlassCard icon={<Luggage size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('LUGGAGE')}>
            <div className="card-title">LUGGAGE</div>
            <div className="card-sub">WEIGHT</div>
            <div className="card-value">18KG</div>
          </GlassCard>
        </div>

        {/* Center Bottom (Navigation / Translate) */}
        <div className="center-bottom">
          <GlassCard icon={<Globe size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('TRANSLATE')}>
            <div className="card-value" style={{marginBottom: '5px'}}>A ↔ B</div>
            <div className="card-sub">ESP → ENG</div>
          </GlassCard>

          <GlassCard icon={<MapPin size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('NAVIGATION')}>
            <div className="card-title">NAVIGATION</div>
            <div className="card-sub" style={{marginTop: '5px'}}>DESTINATION</div>
            <div className="card-value" style={{fontSize: '20px'}}>550KM</div>
          </GlassCard>
        </div>

        {/* Right Column */}
        <div className="side-column right">
          <GlassCard icon={<Settings size={36} strokeWidth={1.5} />} isCenter={true} onClick={() => setActiveModal('SETTINGS')}>
            <div className="card-title" style={{marginTop: '10px'}}>SETTINGS</div>
          </GlassCard>

          <GlassCard icon={<Camera size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('LOCAL TIPS')}>
            <div className="card-title">LOCAL TIPS</div>
            <div className="card-sub" style={{marginTop: '5px'}}>ART DISTRICT</div>
            <div className="card-sub">VIEW CITY</div>
          </GlassCard>

          <GlassCard icon={<HeartPulse size={36} strokeWidth={1.5} />} onClick={() => setActiveModal('HEALTH STATS')}>
            <div className="card-title">HEALTH STATS</div>
            <div className="card-value" style={{fontSize: '22px', marginTop: '5px', marginBottom: '5px'}}>HR 72</div>
            <div className="card-sub">HEALTH OK</div>
          </GlassCard>
        </div>

      </div>

      {/* Modal Overlay */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setActiveModal(null)}>
              <X size={24} />
            </button>
            <h2 className="modal-title">{activeModal} DETAILS</h2>
            <div className="modal-body">
              <p>{getModalContent()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Display */}
      {subtitle && (
        <div className="subtitle-display">
          {subtitle}
        </div>
      )}

      {/* Real-time Transcript Display */}
      {currentTranscript && !subtitle && (
        <div className="transcript-display">
          <span className="transcript-label">YOU:</span> {currentTranscript}
        </div>
      )}

      {/* Listening Status */}
      {isListening && !isSpeaking && !isProcessing && !subtitle && !currentTranscript && (
        <div className="listening-status">
          {isDetectingSpeech ? '🎤 LISTENING...' : '🎤 WAITING FOR SPEECH...'}
        </div>
      )}

      {/* Voice Control Button */}
      <div className="voice-control-container">
        <button 
          className={`voice-btn ${isListening ? 'listening' : ''} ${isAwake ? 'awake' : ''}`}
          onClick={isListening ? stopListening : startListening}
          title={isListening ? 'Stop listening' : 'Start voice control'}
        >
          {isListening ? '●' : '🎤'}
        </button>
      </div>

      {/* Text Input for Testing */}
      <div className="text-input-container">
        <form onSubmit={handleTextSubmit}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={isAwake ? 'Say something to Alvi...' : 'Type "alvi" to wake me up...'}
            className="text-input"
          />
        </form>
      </div>

    </div>
  )
}
