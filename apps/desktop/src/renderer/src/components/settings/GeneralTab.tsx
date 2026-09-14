import { AboutSection } from './AboutSection';
import { AppearancePicker } from './AppearancePicker';
import { SectionTitle } from './ItemList';
import { ServerSection } from './ServerSection';

export function GeneralTab() {
  return (
    <div className="flex flex-col gap-8 px-4 py-3" data-slot="general-tab">
      <section className="flex flex-col gap-2">
        <SectionTitle>Appearance</SectionTitle>
        <AppearancePicker />
      </section>
      <ServerSection />
      <AboutSection />
    </div>
  );
}
