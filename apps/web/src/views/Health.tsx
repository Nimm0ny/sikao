import React, { useState, useEffect } from 'react';

type VersionData = Record<string, unknown> | { error: string } | null;

const Health: React.FC = () => {
  const [versionData, setVersionData] = useState<VersionData>(null);

  useEffect(() => {
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersionData(data))
      .catch(() => setVersionData({ error: 'Failed to load version info' }));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>System Status: OK</h1>
      <pre style={{ background: 'var(--paper-2)', padding: 20, borderRadius: 8 }}>
        {JSON.stringify(versionData, null, 2)}
      </pre>
    </div>
  );
};

export default Health;
