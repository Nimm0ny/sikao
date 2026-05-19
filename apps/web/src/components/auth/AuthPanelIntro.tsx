export interface AuthPanelIntroProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly align?: 'left' | 'center';
}

export function AuthPanelIntro({
  eyebrow,
  title,
  subtitle,
  align = 'left',
}: AuthPanelIntroProps) {
  const alignmentClass = align === 'center' ? 'text-center items-center' : '';

  return (
    <header className={`mb-8 flex flex-col ${alignmentClass}`}>
      <p className="font-mono text-tiny tracking-eyebrow uppercase text-ink-3">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-h-section font-medium leading-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 max-w-[32rem] text-sm leading-relaxed text-ink-3">
        {subtitle}
      </p>
    </header>
  );
}
