/* Tweaks panel for 行测答题 — theme (other settings moved to ⚙ in topbar) */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "warm"
}/*EDITMODE-END*/;

function XingceTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
  }, [t.theme]);

  return (
    <TweaksPanel>
      <TweakSection label="主题">
        <TweakRadio label="Theme" value={t.theme}
          options={[{value:'warm',label:'Warm'},{value:'pure',label:'Pure'},{value:'night',label:'Night'}]}
          onChange={v => setTweak('theme', v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweaks-mount')).render(<XingceTweaks />);
