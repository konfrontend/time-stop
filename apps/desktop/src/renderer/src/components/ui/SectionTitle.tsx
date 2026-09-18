export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      data-slot="section-title"
      className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
    >
      {children}
    </h2>
  );
}
