import FinancialRatesTable from '../../components/financials/FinancialRatesTable';
import { mockAudioRates } from '../../data/mockFinancials';

export default function AudioRatesPage() {
  return (
    <FinancialRatesTable
      titleKey="audioRates"
      subtitleKey="audioRatesSubtitle"
      rows={mockAudioRates}
    />
  );
}
