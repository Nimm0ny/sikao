# SIKAO Tweaks Protocol · React Implementation

## Source
- File: SIKAO Redesign.html lines 3487-3526
- Script framework: React 18.3.1 + Babel standalone
- Reference HTML element: id="tweaks-mount"

## Data Model

\\\js
const DEFAULTS = {
  theme:        "reading",      // reading | pure | night
  density:      "compact",      // compact | cozy
  reading:      "md",           // md | lg | xl
  nav:          "left",         // left | top
  optionStyle:  "line"          // line | card
}
\\\

## State Management Hook

\\\js
function useTweaks(defaults) {
  const [tweaks, setTweaks] = React.useState(defaults);
  
  const setTweak = (key, value) => {
    setTweaks(prev => ({ ...prev, [key]: value }));
  };
  
  return [tweaks, setTweak];
}
\\\

## HTML Attribute Syncing

Each tweak controls a data attribute on <html> or <body>:

\\\js
React.useEffect(() => {
  document.body.dataset.theme = t.theme;
  document.body.dataset.density = t.density;
  document.body.dataset.reading = t.reading;
  document.body.dataset.nav = t.nav;
  document.body.dataset.options = t.optionStyle;
}, [t.theme, t.density, t.reading, t.nav, t.optionStyle]);
\\\

### CSS Selectors for Each Tweak

Theme switching:
\\\css
[data-theme="reading"] { --paper: #FAF7F0; --ink: #1A1815; }
[data-theme="pure"]    { --paper: #FFFFFF; --ink: #0A0A0B; }
[data-theme="night"]   { --paper: #1B1814; --ink: #F2EAD8; }
\\\

Density switching:
\\\css
[data-density="compact"] { --pad-card: 20px; --gap-card: 12px; }
[data-density="cozy"]    { --pad-card: 28px; --gap-card: 18px; }
\\\

Reading size:
\\\css
[data-reading="md"] { --t-body: 15px; --t-sm: 13px; }
[data-reading="lg"] { --t-body: 16px; --t-sm: 14px; }
[data-reading="xl"] { --t-body: 17px; --t-sm: 15px; }
\\\

Navigation layout:
\\\css
[data-nav="left"] .shell { grid-template-columns: 240px 1fr; }
[data-nav="top"]  .shell { grid-template-columns: 1fr; }
[data-nav="top"]  .topnav { display: flex; }
[data-nav="top"]  .sidebar { display: none; }
\\\

Option style:
\\\css
[data-options="line"] .fb-opt .tag { background: transparent; }
[data-options="card"] .fb-opt .tag { background: var(--paper-2); }
\\\

## React Component Structure

\\\jsx
function SikaoTweaks() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  
  React.useEffect(() => {
    document.body.dataset.theme = t.theme;
    document.body.dataset.density = t.density;
    document.body.dataset.reading = t.reading;
    document.body.dataset.nav = t.nav;
    document.body.dataset.options = t.optionStyle;
  }, [t.theme, t.density, t.reading, t.nav, t.optionStyle]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="主题">
        <TweakSelect 
          label="Theme" 
          value={t.theme} 
          options={['reading','pure','night']} 
          onChange={(v) => setTweak('theme', v)} 
        />
      </TweakSection>
      
      <TweakSection title="导航位置">
        <TweakRadio 
          label="Nav" 
          value={t.nav} 
          options={['left','top']} 
          onChange={(v) => setTweak('nav', v)} 
        />
      </TweakSection>
      
      <TweakSection title="密度">
        <TweakRadio 
          label="Density" 
          value={t.density} 
          options={['compact','cozy']} 
          onChange={(v) => setTweak('density', v)} 
        />
      </TweakSection>
      
      <TweakSection title="阅读字号">
        <TweakRadio 
          label="Size" 
          value={t.reading} 
          options={['md','lg','xl']} 
          onChange={(v) => setTweak('reading', v)} 
        />
      </TweakSection>
      
      <TweakSection title="选项样式">
        <TweakRadio 
          label="Options" 
          value={t.optionStyle} 
          options={['card','line']} 
          onChange={(v) => setTweak('optionStyle', v)} 
        />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(
  document.getElementById('tweaks-mount')
).render(<SikaoTweaks />);
\\\

## Helper Component Specs

### TweaksPanel

\\\jsx
function TweaksPanel({ title, children }) {
  return (
    <div class="tweaks-panel" role="region" aria-label={title}>
      <div class="tweaks-header">
        <h3>{title}</h3>
        <button class="tweaks-close" aria-label="Close">✕</button>
      </div>
      <div class="tweaks-body">
        {children}
      </div>
    </div>
  );
}
\\\

### TweakSection

\\\jsx
function TweakSection({ title, children }) {
  return (
    <div class="tweak-section">
      <label class="tweak-label">{title}</label>
      {children}
    </div>
  );
}
\\\

### TweakSelect (Dropdown)

\\\jsx
function TweakSelect({ label, value, options, onChange }) {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}
\\\

### TweakRadio (Radio Group)

\\\jsx
function TweakRadio({ label, value, options, onChange }) {
  return (
    <div class="tweak-radio-group" role="group" aria-label={label}>
      {options.map(opt => (
        <label key={opt} class="tweak-radio">
          <input
            type="radio"
            name={label}
            value={opt}
            checked={value === opt}
            onChange={(e) => onChange(e.target.value)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
\\\

## Persistence Strategy (Optional)

To persist tweaks across sessions, integrate with localStorage:

\\\js
function useTweaksWithStorage(defaults) {
  const [tweaks, setTweaks] = React.useState(() => {
    const saved = localStorage.getItem('sikao-tweaks');
    return saved ? JSON.parse(saved) : defaults;
  });

  const setTweak = (key, value) => {
    const updated = { ...tweaks, [key]: value };
    setTweaks(updated);
    localStorage.setItem('sikao-tweaks', JSON.stringify(updated));
  };

  return [tweaks, setTweak];
}
\\\

## CSS Variables Cascade

Ensure CSS variables are defined at :root level, then theme/density/size selectors override:

\\\css
:root {
  --paper: #FAF7F0;
  --t-body: 15px;
  --pad-card: 24px;
}

[data-theme="pure"] {
  --paper: #FFFFFF;
  /* overrides for pure theme */
}

[data-reading="xl"] {
  --t-body: 17px;
}

[data-density="cozy"] {
  --pad-card: 28px;
}
\\\

## Testing Checklist

- [ ] Theme switch updates document.body.dataset.theme
- [ ] Density switch updates document.body.dataset.density
- [ ] Reading size updates document.body.dataset.reading
- [ ] Nav toggle updates document.body.dataset.nav
- [ ] Option style updates document.body.dataset.options
- [ ] All CSS variables update reactively
- [ ] No visual glitch on rapid theme switching
- [ ] Tweaks panel is accessible (ARIA labels, keyboard nav)
- [ ] localStorage persistence works (if enabled)
- [ ] Mobile: tweaks panel is dismissible/sticky

