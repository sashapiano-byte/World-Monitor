import { Explorer } from '@/components/Explorer';
import { buildFacilityViews, getDataset } from '@/lib/dataset';

export const dynamic = 'force-static';

export default function MapPage() {
  const dataset = getDataset();
  const views = buildFacilityViews(dataset);

  const dates = dataset.incidents.map((i) => i.incidentDate).sort();
  const dateBounds = {
    min: dates[0] ?? '2022-02-24',
    max: dates[dates.length - 1] ?? dataset.generatedAt,
  };

  return (
    <Explorer views={views} industries={dataset.industries} regions={dataset.regions} dateBounds={dateBounds} />
  );
}
