import { useEffect, useState } from 'react'
import { BrainCircuit, CheckCircle2, ExternalLink, Ear, GitBranch, KeyRound, Loader2, Mic2 } from 'lucide-react'
import { interviewApi } from './api'

/* Setup: three jobs, three keys, and the instructions for finding each one.
 *
 * The three are laid out as separate cards rather than one form because they
 * are separate decisions with separate consequences. The chat key is the only
 * required one — both voice jobs have a keyless browser option — and saying so
 * plainly is the difference between someone trying this project and someone
 * closing the tab at a wall of five inputs.
 *
 * Every card carries a "where do I get this" panel with a direct link to the
 * right page of the right console and the two or three steps once you are
 * there. That panel is not decoration: "bring your own key" quietly means "go
 * and work out where from", and this is the part of a BYO-key project that
 * actually loses people.
 */

function ProviderCard({ icon: Icon, title, subtitle, required, configured, catalog,
                        provider, onProvider, model, onModel, voice, onVoice,
                        apiKey, onApiKey, keyHint }) {
  const [open, setOpen] = useState(false)
  const active = catalog.find((item) => item.provider === provider) || catalog[0] || {}
  const keyless = Boolean(active.keyless)

  return (
    <section className="ia-card">
      <header className="ia-card-head">
        <h3><Icon size={15} /> {title}</h3>
        {configured
          ? <span className="ia-pill-good"><CheckCircle2 size={12} /> ready</span>
          : <span className={required ? 'ia-pill-warn' : 'ia-pill'}>{required ? 'required' : 'optional'}</span>}
      </header>
      <p className="ia-note">{subtitle}</p>

      <div className="ia-choice-row">
        {catalog.map((item) => (
          <button key={item.provider}
                  type="button"
                  className={`ia-choice ${item.provider === provider ? 'active' : ''}`}
                  onClick={() => { onProvider(item.provider); onModel(item.models[0]); onVoice?.(item.voices?.[0]?.id || '') }}>
            {item.label}
            {item.keyless && <span className="ia-choice-tag">no key</span>}
          </button>
        ))}
      </div>

      {active.note && <p className="ia-muted ia-provider-note">{active.note}</p>}

      <div className="ia-field-row">
        <label>
          <span>Model</span>
          <select value={model} onChange={(event) => onModel(event.target.value)}>
            {(active.models || []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {onVoice && (active.voices || []).length > 0 && (
          <label>
            <span>Voice</span>
            <select value={voice} onChange={(event) => onVoice(event.target.value)}>
              {active.voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {!keyless && (
        <label className="ia-key-field">
          <span>API key {keyHint && <em>saved {keyHint}</em>}</span>
          <input type="password"
                 autoComplete="off"
                 value={apiKey}
                 placeholder={keyHint ? 'Leave blank to keep the saved key' : active.key_hint || 'Paste your key'}
                 onChange={(event) => onApiKey(event.target.value)} />
        </label>
      )}

      {(active.steps || []).length > 0 && (
        <div className="ia-help">
          <button type="button" className="ia-help-toggle" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : keyless ? 'What this means' : 'Where do I get this key?'}
          </button>
          {open && (
            <div className="ia-help-body">
              <ol>{active.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              {active.console_url && (
                <a href={active.console_url} target="_blank" rel="noreferrer">
                  Open {active.label} <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function Setup({ setup, onSaved }) {
  const [form, setForm] = useState(null)
  const [keys, setKeys] = useState({ chat: '', stt: '', tts: '', github: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!setup) return
    setForm({
      chat_provider: setup.chat_provider, chat_model: setup.chat_model,
      stt_provider: setup.stt_provider, stt_model: setup.stt_model,
      tts_provider: setup.tts_provider, tts_model: setup.tts_model, tts_voice: setup.tts_voice,
    })
  }, [setup])

  if (!setup || !form) return <div className="ia-loading"><Loader2 size={18} className="ia-spin" /> Loading…</div>

  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const catalog = setup.providers

  const save = async () => {
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await interviewApi('/setup', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          chat_api_key: keys.chat.trim(),
          stt_api_key: keys.stt.trim(),
          tts_api_key: keys.tts.trim(),
          github_token: keys.github.trim(),
        }),
      })
      setKeys({ chat: '', stt: '', tts: '', github: '' })
      setNotice(saved.ready
        ? 'Saved. Next: build your candidate brief on the Profile tab.'
        : 'Saved, but there is still no chat key — nothing can be planned or graded without one.')
      onSaved(saved)
    } catch (requestError) {
      setError(requestError.message)
    }
    setSaving(false)
  }

  return (
    <div className="ia-pane">
      <div className="ia-card ia-intro">
        <h3><KeyRound size={15} /> Three jobs, three keys</h3>
        <p>{catalog.note}</p>
        <p className="ia-muted">
          Keys are stored against your account and are never sent back to this page — only the last
          four characters, so you can tell which one is saved. Everything is deleted automatically
          after the retention window.
        </p>
      </div>

      <ProviderCard icon={BrainCircuit}
                    title="1. The model that interviews you"
                    subtitle="Writes the plan, grades every answer and produces the report. This is the only key you actually need."
                    required
                    configured={setup.chat_configured}
                    catalog={catalog.chat}
                    provider={form.chat_provider} onProvider={(value) => set({ chat_provider: value })}
                    model={form.chat_model} onModel={(value) => set({ chat_model: value })}
                    apiKey={keys.chat} onApiKey={(value) => setKeys({ ...keys, chat: value })}
                    keyHint={setup.chat_key_hint} />

      <ProviderCard icon={Ear}
                    title="2. The model that hears you"
                    subtitle="Turns your spoken answer into the transcript that gets graded. The browser does this free and badly; a hosted Whisper does it properly."
                    configured={setup.stt_configured}
                    catalog={catalog.stt}
                    provider={form.stt_provider} onProvider={(value) => set({ stt_provider: value })}
                    model={form.stt_model} onModel={(value) => set({ stt_model: value })}
                    apiKey={keys.stt} onApiKey={(value) => setKeys({ ...keys, stt: value })}
                    keyHint={setup.stt_key_hint} />

      <ProviderCard icon={Mic2}
                    title="3. The voice that asks"
                    subtitle="Reads each question out loud. Rehearsing against a real-sounding voice is most of the value of practising out loud at all."
                    configured={setup.tts_configured}
                    catalog={catalog.tts}
                    provider={form.tts_provider} onProvider={(value) => set({ tts_provider: value })}
                    model={form.tts_model} onModel={(value) => set({ tts_model: value })}
                    voice={form.tts_voice} onVoice={(value) => set({ tts_voice: value })}
                    apiKey={keys.tts} onApiKey={(value) => setKeys({ ...keys, tts: value })}
                    keyHint={setup.tts_key_hint} />

      <section className="ia-card">
        <header className="ia-card-head">
          <h3><GitBranch size={15} /> GitHub token</h3>
          <span className="ia-pill">optional</span>
        </header>
        <p className="ia-note">
          Only raises the rate limit. GitHub allows 60 unauthenticated requests an hour per address,
          which a shared deployment burns through quickly. Create one at{' '}
          <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
            github.com/settings/tokens <ExternalLink size={11} />
          </a>{' '}
          with <strong>no scopes at all</strong> — nothing private is ever requested.
        </p>
        <label className="ia-key-field">
          <span>Token {setup.github_token_hint && <em>saved {setup.github_token_hint}</em>}</span>
          <input type="password" autoComplete="off" value={keys.github}
                 placeholder={setup.github_token_hint ? 'Leave blank to keep the saved token' : 'ghp_… or github_pat_…'}
                 onChange={(event) => setKeys({ ...keys, github: event.target.value })} />
        </label>
      </section>

      {error && <p className="ia-error">{error}</p>}
      {notice && <p className="ia-notice">{notice}</p>}

      <div className="ia-actions">
        <button className="ia-primary" onClick={save} disabled={saving}>
          {saving ? <><Loader2 size={14} className="ia-spin" /> Saving…</> : 'Save setup'}
        </button>
      </div>
    </div>
  )
}
