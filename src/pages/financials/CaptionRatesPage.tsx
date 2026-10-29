import FinancialRatesTable from '../../components/financials/FinancialRatesTable';
import { mockCaptionRates } from '../../data/mockFinancials';

export default function CaptionRatesPage() {
  return (
    <FinancialRatesTable
      titleKey="captionRates"
      subtitleKey="captionRatesSubtitle"
      rows={mockCaptionRates}
    />
  );
}
