import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSpokenAudio, uploadRecording } from './api'

/* Hearing and speaking in the browser, with two completely different backends
 * behind one interface.
 *
 * The `browser` option is the Web Speech API: recognition runs on-device and
 * never leaves the page, and synthesis uses whatever voices the operating
 * system installed. It is free, it needs no key, and it is noticeably worse —
 * it drops exactly the technical vocabulary this project is grading.
 *
 * Every other option records audio with MediaRecorder and posts it to the
 * server, which forwards it to the provider holding the user's key. The key
 * never reaches the browser, which is the reason the audio makes the round trip
 * rather than being sent to the provider directly.
 *
 * Both are hidden behind `startRecording` / `stopRecording`, where stop resolves
 * with the transcript whichever path produced it. The caller then does not care.
 */

const Recognition = typeof window !== 'undefined'
  && (window.SpeechRecognition || window.webkitSpeechRecognition)

export const browserSpeechSupported = Boolean(Recognition)
export const browserVoiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

// Chrome and Edge record webm/opus; Safari only does mp4. Ask for what the
// browser admits to supporting rather than guessing and getting silence.
function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''
}

export function useVoice({ sttProvider, ttsProvider }) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  const recorder = useRef(null)
  const chunks = useRef([])
  const stream = useRef(null)
  const recognition = useRef(null)
  const finalText = useRef('')
  const settle = useRef(null)
  const audio = useRef(null)

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    if (audio.current) { audio.current.pause(); audio.current.src = '' ; audio.current = null }
    setSpeaking(false)
  }, [])

  // Releasing the microphone track matters: leaving it open keeps the browser's
  // recording indicator lit long after the interview has finished.
  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }, [])

  useEffect(() => () => { stopSpeaking(); release() }, [stopSpeaking, release])

  const speak = useCallback(async (text) => {
    if (!text?.trim()) return
    stopSpeaking()
    setError('')
    if (ttsProvider === 'browser') {
      if (!browserVoiceSupported) { setError('This browser has no built-in voice.'); return }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.98
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
      return
    }
    setSpeaking(true)
    try {
      const blob = await fetchSpokenAudio(text)
      const player = new Audio(URL.createObjectURL(blob))
      audio.current = player
      player.onended = () => setSpeaking(false)
      // Autoplay is blocked until the page has been interacted with. It always
      // has been by this point — the user pressed Start — but a stale tab can
      // still refuse, and a silent failure would look like a broken key.
      await player.play().catch(() => setError('The browser blocked audio playback. Click the page and try again.'))
    } catch (requestError) {
      setError(requestError.message)
      setSpeaking(false)
    }
  }, [ttsProvider, stopSpeaking])

  const startRecording = useCallback(async () => {
    setError('')
    setInterim('')
    finalText.current = ''
    stopSpeaking()

    if (sttProvider === 'browser') {
      if (!browserSpeechSupported) {
        setError('This browser has no built-in speech recognition. Use Chrome or Edge, pick a hosted provider in Setup, or type your answer.')
        return false
      }
      const engine = new Recognition()
      engine.continuous = true
      engine.interimResults = true
      engine.lang = 'en-US'
      engine.onresult = (event) => {
        let pending = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (result.isFinal) finalText.current += `${result[0].transcript} `
          else pending += result[0].transcript
        }
        setInterim(pending)
      }
      // `no-speech` fires on any pause and is not an error worth showing.
      engine.onerror = (event) => { if (event.error !== 'no-speech' && event.error !== 'aborted') setError(`Speech recognition failed: ${event.error}`) }
      engine.onend = () => { settle.current?.(finalText.current.trim()); settle.current = null; setRecording(false) }
      recognition.current = engine
      engine.start()
      setRecording(true)
      return true
    }

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone permission was refused. Allow it in the browser, or type your answer instead.')
      return false
    }
    const mimeType = pickMimeType()
    const media = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined)
    chunks.current = []
    media.ondataavailable = (event) => { if (event.data.size > 0) chunks.current.push(event.data) }
    media.onstop = async () => {
      release()
      const type = media.mimeType || mimeType || 'audio/webm'
      const blob = new Blob(chunks.current, { type })
      setRecording(false)
      if (blob.size < 1200) { settle.current?.(''); settle.current = null; return }
      setTranscribing(true)
      try {
        const extension = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
        const result = await uploadRecording(blob, `answer.${extension}`)
        settle.current?.(result.text || '')
      } catch (requestError) {
        setError(requestError.message)
        settle.current?.('')
      } finally {
        settle.current = null
        setTranscribing(false)
      }
    }
    recorder.current = media
    media.start()
    setRecording(true)
    return true
  }, [sttProvider, stopSpeaking, release])

  /** Stop, and resolve with everything that was said. */
  const stopRecording = useCallback(() => new Promise((resolve) => {
    settle.current = resolve
    setInterim('')
    if (sttProvider === 'browser') {
      if (recognition.current) recognition.current.stop()
      else { settle.current = null; resolve('') }
      return
    }
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
    else { settle.current = null; resolve('') }
  }), [sttProvider])

  return {
    recording, transcribing, speaking, interim, error,
    speak, stopSpeaking, startRecording, stopRecording,
    clearError: () => setError(''),
  }
}
