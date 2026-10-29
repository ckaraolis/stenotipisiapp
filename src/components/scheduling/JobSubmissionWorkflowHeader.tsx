import type { JobRecord } from '../../types/jobRecord';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface JobSubmissionWorkflowHeaderProps {
  job: JobRecord;
}

export default function JobSubmissionWorkflowHeader({ job }: JobSubmissionWorkflowHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="workflow-wizard-job-header">
      <div className="profile-grid">
        <label className="profile-label" htmlFor="submission-job-number">
          {t('jobNumber')}
        </label>
        <input
          id="submission-job-number"
          type="text"
          className="profile-input profile-input-readonly"
          value={job.jobNumber}
          readOnly
        />

        <label className="profile-label" htmlFor="submission-customer">
          {t('customer')}
        </label>
        <input
          id="submission-customer"
          type="text"
          className="profile-input profile-input-readonly"
          value={job.customerName || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="submission-project">
          {t('project')}
        </label>
        <input
          id="submission-project"
          type="text"
          className="profile-input profile-input-readonly"
          value={job.projectNumber || '—'}
          readOnly
        />

        <label className="profile-label" htmlFor="submission-date">
          {t('date')}
        </label>
        <input
          id="submission-date"
          type="text"
          className="profile-input profile-input-readonly"
          value={job.date}
          readOnly
        />
      </div>
    </div>
  );
}
