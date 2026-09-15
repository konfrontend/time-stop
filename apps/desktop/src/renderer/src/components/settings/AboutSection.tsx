import { useVersion } from '@/hooks/useRelease';
import { useServer } from '@/hooks/useSync';
import { SectionTitle } from './ItemList';

export function AboutSection() {
  const version = useVersion();
  const server = useServer();
  return (
    <section
      className="flex flex-col gap-1 text-xs text-muted-foreground"
      data-slot="about-section"
    >
      <SectionTitle>About</SectionTitle>
      {version.data && <p data-slot="app-version">Time Stop {version.data}</p>}
      {server.data && <p className="break-all">Database {server.data.databasePath}</p>}
    </section>
  );
}
