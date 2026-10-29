import { useMemo, useState } from 'react';
import TranscriptsTable from '../../components/TranscriptsTable';
import { getTranscriptListSubtitleKey } from '../../config/transcriptList';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import type { TranscriptType, TranscriptViewScope } from '../../types/transcript';

interface TranscriptsViewProps {
  variant: TranscriptType;
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
}

export default function TranscriptsView({
  variant,
  titleKey,
  subtitleKey,
}: TranscriptsViewProps) {
  const { t } = useLanguage();
  const [viewScope, setViewScope] = useState<TranscriptViewScope>('none');

  const resolvedSubtitleKey = useMemo(
    () => subtitleKey ?? getTranscriptListSubtitleKey(viewScope),
    [subtitleKey, viewScope],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t(titleKey)}</h1>
          <p className="page-subtitle">{t(resolvedSubtitleKey)}</p>
        </div>
        <div className="page-header-badge">{t('liveWorkspace')}</div>
      </div>
      <TranscriptsTable variant={variant} onViewScopeChange={setViewScope} />
    </>
  );
}
