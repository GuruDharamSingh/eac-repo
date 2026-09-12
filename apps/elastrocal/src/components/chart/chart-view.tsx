import { formatLatitude, formatLongitude, type ChartResult } from "@elkdonis/astro";
import { ChartWheel } from "@elkdonis/sky-ui";
import { AspectsTable, ChartSummary, HousesTable, PositionsTable } from "./tables";

/** Wheel, summary and the three tables — one layout for sky, preview and saved charts. */
export function ChartView({ chart, caption }: { chart: ChartResult; caption?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {chart.warnings.length > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-accent-foreground">
          {chart.warnings.join(" ")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <ChartWheel chart={chart} />
          <p className="text-center text-xs text-muted-foreground">
            {caption ?? (
              <>
                {new Date(chart.utc).toUTCString().replace("GMT", "UTC")} · {formatLatitude(chart.input.latitude)}{" "}
                {formatLongitude(chart.input.longitude)}
              </>
            )}
          </p>
        </div>
        <div className="space-y-6">
          <ChartSummary chart={chart} />
          <PositionsTable chart={chart} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <HousesTable chart={chart} />
        <AspectsTable chart={chart} />
      </div>
    </div>
  );
}
