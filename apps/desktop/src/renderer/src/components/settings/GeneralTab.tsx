import { SectionTitle } from '@/components/ui/SectionTitle';
import { AboutSection } from './AboutSection';
import { AppearancePicker } from './AppearancePicker';
import { ServerSection } from './ServerSection';

export function GeneralTab() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-3"
      data-slot="general-tab"
    >
      <section className="flex flex-col gap-2">
        <SectionTitle>Appearance</SectionTitle>
        <AppearancePicker />
      </section>
      <ServerSection />
      <AboutSection />
    </div>
  );
}
