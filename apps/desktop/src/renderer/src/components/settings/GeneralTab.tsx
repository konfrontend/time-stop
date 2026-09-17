import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AboutSection } from './AboutSection';
import { AppearancePicker } from './AppearancePicker';
import { ServerSection } from './ServerSection';

export function GeneralTab() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3"
      data-slot="general-tab"
    >
      <Card className="gap-2 p-3" data-slot="appearance-section">
        <SectionTitle>Appearance</SectionTitle>
        <AppearancePicker />
      </Card>
      <ServerSection />
      <AboutSection />
    </div>
  );
}
