'use client';

import { useEffect, useRef, useState } from 'react';
import { crowds, energies, languageStyles } from '@/utils/vibeRadio';
import Icon from './Icon';
import styles from './VibeSetup.module.css';

const questions = ['What languages are we playing?', 'What kind of music?', 'Where are we in the night?', 'Who’s in the room?'];

function Choices({ label, options, selected, onSelect, compact }) {
  return (
    <fieldset className={styles.choices}>
      {label && <legend>{label}</legend>}
      <div className={compact ? styles.chips : styles.tiles}>
        {options.map(([value, text, detail]) => (
          <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => onSelect(value)}>
            <strong>{text}</strong>{detail && !compact && <small>{detail}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const languageOptions = Object.keys(languageStyles).map((language) => [language, language]);
const energyOptions = Object.entries(energies).map(([value, [label, detail]]) => [value, label, detail]);
const crowdOptions = Object.entries(crowds).map(([value, [label, detail]]) => [value, label, detail]);

function toggle(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function VibeSetup({ initial, editing, onApply, onClose }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initial);
  const dialog = useRef(null);
  const body = useRef(null);
  const heading = useRef(null);
  const lastStep = step === questions.length - 1;
  const canSkipStyles = step === 1 && draft.languages.every((language) => !draft.styles[language]?.length);
  const update = (change) => setDraft((current) => ({ ...current, ...change }));

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    body.current.scrollTop = 0;
    heading.current.focus({ preventScroll: true });
  }, [step]);

  function closeSetup() {
    dialog.current.close();
    onClose();
  }

  const chooseLanguages = () => (
    <Choices label={editing ? 'Languages' : null} options={languageOptions} selected={draft.languages}
      onSelect={(language) => update({ languages: toggle(draft.languages, language) })} compact={editing} />
  );
  const chooseStyles = () => draft.languages.map((language) => (
    <Choices key={language} label={`${language} style (optional)`} selected={draft.styles[language] ?? []}
      options={languageStyles[language].map((style) => [style, style])} compact={editing}
      onSelect={(style) => update({ styles: { ...draft.styles, [language]: toggle(draft.styles[language] ?? [], style) } })} />
  ));
  const chooseEnergy = () => (
    <Choices label={editing ? 'Energy' : null} options={energyOptions} selected={[draft.energy]} compact={editing}
      onSelect={(energy) => update({ energy, warmupMinutes: energy === 'warm' ? draft.warmupMinutes : 0 })} />
  );
  const chooseCrowd = () => (
    <Choices label={editing ? 'Crowd' : null} options={crowdOptions} selected={[draft.crowd]} compact={editing}
      onSelect={(crowd) => update({ crowd })} />
  );

  return (
    <dialog ref={dialog} className={styles.dialog} data-step={editing ? undefined : step} aria-labelledby="vibe-setup-heading"
      onCancel={(event) => { event.preventDefault(); closeSetup(); }}>
      <header className={styles.top}>
        {editing ? <span>Vibe Radio</span> : (
          <div className={styles.progress}>
            <span id="vibe-setup-progress">Step {step + 1} of {questions.length}</span>
            <span className={styles.progressTrack} aria-hidden="true">
              {questions.map((question, index) => <i key={question} data-reached={index <= step} />)}
            </span>
          </div>
        )}
        <button className={styles.close} type="button" onClick={closeSetup} aria-label="Close vibe setup"><Icon name="close" size={19} /></button>
      </header>
      <div className={styles.body} ref={body}>
        <h2 id="vibe-setup-heading" ref={heading} tabIndex={-1} aria-describedby={editing ? undefined : 'vibe-setup-progress'}>{editing ? 'Change the vibe' : questions[step]}</h2>
        {editing && <p>The current song keeps playing. We’ll pick a new queue for what comes next.</p>}
        {!editing && step === 0 && <p>Pick every language you want to hear.</p>}
        {!editing && step === 1 && <p>Pick styles for each language, or leave them open.</p>}
        {(editing || step === 2) && chooseEnergy()}
        {(editing || step === 3) && chooseCrowd()}
        {(editing || step === 0) && chooseLanguages()}
        {(editing || step === 0) && draft.languages.length > 1 && (
          <label className={styles.field}>Language priority
            <select value={draft.languages.includes(draft.priority) ? draft.priority : ''} onChange={(event) => update({ priority: event.target.value })}>
              <option value="">Balance languages</option>
              {draft.languages.map((language) => <option key={language} value={language}>More {language}</option>)}
            </select>
          </label>
        )}
        {(editing || step === 1) && chooseStyles()}
        {(editing || step === 2) && draft.energy === 'warm' && (
          <label className={styles.field}>Energy progression
            <select value={draft.warmupMinutes} onChange={(event) => update({ warmupMinutes: Number(event.target.value) })}>
              <option value={0}>Keep it steady</option><option value={15}>Peak after 15 minutes</option>
              <option value={20}>Peak after 20 minutes</option><option value={30}>Peak after 30 minutes</option>
            </select>
          </label>
        )}
        {!editing && step === 3 && (
          <details className={styles.options}>
            <summary>Session options <Icon name="down" size={16} /></summary>
            <div className={styles.settings}>
              <label className={styles.field}>How long should it play?
                <select value={draft.duration} onChange={(event) => update({ duration: Number(event.target.value) })}>
                  <option value={0}>Keep playing</option><option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option><option value={120}>2 hours</option>
                </select>
              </label>
              {draft.duration > 0 && <label className={styles.check}><input type="checkbox" checked={draft.windDown}
                onChange={(event) => update({ windDown: event.target.checked })} /> Wind down in the last 10 minutes</label>}
              <label className={styles.check}><input type="checkbox" checked={draft.originals}
                onChange={(event) => update({ originals: event.target.checked })} /> Prefer original versions</label>
              <label className={styles.field}>Must-play songs (optional)
                <textarea value={draft.anchors} maxLength={450} onChange={(event) => update({ anchors: event.target.value })}
                  placeholder="Up to three song titles with artist names, one per line" rows={3} />
              </label>
            </div>
          </details>
        )}
      </div>
      <footer className={styles.actions}>
        {!editing && step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Back</button>}
        <button type="button" className={styles.primary} disabled={!draft.languages.length && (!editing || !draft.query)}
          onClick={() => {
            if (editing || lastStep) {
              dialog.current.close();
              onApply(draft);
            } else setStep(step + 1);
          }}>{editing ? 'Apply vibe' : lastStep ? 'Start Radio' : canSkipStyles ? 'Skip styles' : 'Next'}
          <Icon name={!editing && lastStep ? 'play' : 'arrow'} size={17} />
        </button>
      </footer>
    </dialog>
  );
}
