import {
  auditEntityNameLabelKey,
  auditEntryTypeLabelKey,
  auditModuleLabelKey,
  formatAuditTrailTimestamp,
  formatAuditTrailUserLabel,
  formatParsedAuditEntryDetails,
  parseAuditEntryDetails,
} from '../../config/auditTrail';
import type { AuditTrailEntry } from '../../types/auditTrail';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';

interface AuditTrailDetailsFormProps {
  entry: AuditTrailEntry | null;
  loading?: boolean;
  onClose: () => void;
}

export default function AuditTrailDetailsForm({
  entry,
  loading = false,
  onClose,
}: AuditTrailDetailsFormProps) {
  const { t } = useLanguage();

  const entryDetailsText =
    entry && !loading
      ? formatParsedAuditEntryDetails(parseAuditEntryDetails(entry.entryType, entry.entryDetails), {
          dataLabel: t('auditDataLabel'),
          data: t('auditData'),
          oldData: t('auditOldData'),
          newData: t('auditNewData'),
          fileSize: t('auditFileSize'),
          duration: t('auditDuration'),
          userAgentString: t('auditUserAgentString'),
        })
      : '';

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide audit-trail-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-trail-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-form audit-trail-details-form">
          <h2 id="audit-trail-details-title">{t('auditTrailDetailsTitle')}</h2>

          {loading || !entry ? (
            <p className="profile-message">{t('loading')}</p>
          ) : (
            <div className="profile-grid">
              <label className="profile-label" htmlFor="auditTrailTimestamp">
                {t('timestamp')}
              </label>
              <input
                id="auditTrailTimestamp"
                className="profile-input profile-input-readonly"
                type="text"
                readOnly
                value={formatAuditTrailTimestamp(entry.timestamp)}
              />

              <label className="profile-label" htmlFor="auditTrailUser">
                {t('user')}
              </label>
              <input
                id="auditTrailUser"
                className="profile-input profile-input-readonly"
                type="text"
                readOnly
                value={formatAuditTrailUserLabel({
                  fullName: entry.userFullName,
                  username: entry.userUsername,
                })}
              />

              <label className="profile-label" htmlFor="auditTrailModule">
                {t('module')}
              </label>
              <input
                id="auditTrailModule"
                className="profile-input profile-input-readonly"
                type="text"
                readOnly
                value={t(auditModuleLabelKey(entry.module))}
              />

              <label className="profile-label" htmlFor="auditTrailEntityName">
                {t('entityName')}
              </label>
              <input
                id="auditTrailEntityName"
                className="profile-input profile-input-readonly"
                type="text"
                readOnly
                value={t(auditEntityNameLabelKey(entry.entityName))}
              />

              <label className="profile-label" htmlFor="auditTrailEntityNumber">
                {t('entityNumber')}
              </label>
              <input
                id="auditTrailEntityNumber"
                className="profile-input profile-input-readonly"
                type="text"
                readOnly
                value={entry.entityNumber || '—'}
              />

              <label className="profile-label" htmlFor="auditTrailEntryType">
                {t('entryType')}
              </label>
              <input
                id="auditTrailEntryType"
                className="profile-input profile-input-readonly"
                type="text"
                readOnly
                value={t(auditEntryTypeLabelKey(entry.entryType))}
              />

              <label className="profile-label" htmlFor="auditTrailEntryDetails">
                {t('entryDetails')}
              </label>
              <textarea
                id="auditTrailEntryDetails"
                className="profile-input profile-input-readonly audit-trail-entry-details"
                readOnly
                rows={8}
                value={entryDetailsText || '—'}
              />
            </div>
          )}

          <div className="profile-actions">
            <button type="button" className="profile-cancel-btn" onClick={onClose}>
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
