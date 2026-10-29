import type { ReactNode } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

export interface WorkflowWizardStep {
  id: string;
  label: string;
}

interface WorkflowWizardProps {
  title: string;
  steps: WorkflowWizardStep[];
  currentStepIndex: number;
  completedStepIndexes?: number[];
  header?: ReactNode;
  error?: string;
  saving?: boolean;
  children: ReactNode;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export default function WorkflowWizard({
  title,
  steps,
  currentStepIndex,
  completedStepIndexes = [],
  header,
  error,
  saving = false,
  children,
  onCancel,
  onBack,
  onNext,
  onFinish,
}: WorkflowWizardProps) {
  const { t } = useLanguage();
  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex >= steps.length - 1;

  return (
    <div className="workflow-wizard user-details-form">
      <div className="workflow-wizard-card">
        <div className="workflow-wizard-header">
          <h2>{title}</h2>
        </div>

        {header}

        <div className="workflow-wizard-steps" role="tablist" aria-label={title}>
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = completedStepIndexes.includes(index) && !isActive;
            return (
              <div
                key={step.id}
                className={`workflow-wizard-step${isActive ? ' workflow-wizard-step-active' : ''}${isComplete ? ' workflow-wizard-step-complete' : ''}`}
                role="tab"
                aria-selected={isActive}
              >
                <span className="workflow-wizard-step-index">{index + 1}</span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="profile-alert profile-alert-error" style={{ margin: '0 32px 16px' }}>
            {error}
          </div>
        )}

        <div className="workflow-wizard-body">{children}</div>

        <div className="workflow-wizard-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </button>
          <div className="workflow-wizard-footer-actions">
            {!isFirstStep && (
              <button type="button" className="btn-secondary" onClick={onBack} disabled={saving}>
                {t('back')}
              </button>
            )}
            {isLastStep ? (
              <button type="button" className="btn-primary" onClick={onFinish} disabled={saving}>
                {saving ? t('saving') : t('finish')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={onNext} disabled={saving}>
                {saving ? t('saving') : t('next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
