import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

interface PlaceholderPageProps {
  titleKey: TranslationKey;
}

export default function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useLanguage();

  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{t(titleKey)}</h1>
        <p className="page-subtitle">{t('comingSoon')}</p>
      </div>
    </div>
  );
}
