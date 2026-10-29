import FinancialRatesTable from '../../components/financials/FinancialRatesTable';
import { mockStenoRates } from '../../data/mockFinancials';

export default function StenoRatesPage() {
  return (
    <FinancialRatesTable
      titleKey="stenoRates"
      subtitleKey="stenoRatesSubtitle"
      rows={mockStenoRates}
    />
  );
}
