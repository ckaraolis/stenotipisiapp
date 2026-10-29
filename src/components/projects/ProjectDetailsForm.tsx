import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { fetchCustomers, type CustomerOption } from '../../api/profile';
import { fetchCustomerById, fetchCustomerFieldValues } from '../../api/customers';
import { fetchDistrictOptions } from '../../api/districts';
import { createProject, fetchProjectById, updateProject } from '../../api/projects';
import type { TranscriptOwnerCandidate } from '../../api/projects';
import { travellingChargesLabelKey } from '../../config/customer';
import {
  TRAVELLING_CHARGES_OPTIONS,
  type CustomerFieldStatus,
  type CustomerFieldValue,
  type CustomerRecord,
  type TravellingCharges,
} from '../../types/customer';
import type { DistrictOption } from '../../types/district';
import {
  PROJECT_STATUS_OPTIONS,
  type ProjectPayload,
  type ProjectStatus,
  type ProjectTranscriptOwner,
} from '../../types/project';
import AddTranscriptOwnerDialog from './AddTranscriptOwnerDialog';
import ProjectTranscriptOwnersList from './ProjectTranscriptOwnersList';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface ProjectDetailsFormProps {
  mode: 'create' | 'edit';
  projectId?: string;
  scrollToTranscriptOwners?: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
  onTranscriptOwnersChanged?: () => void;
}

type ProjectFormState = {
  projectNumber: string;
  customerId: string;
  districtId: string;
  field1ValueId: string;
  field2ValueId: string;
  field3: string;
  field4: string;
  travellingCharges: TravellingCharges;
  status: ProjectStatus;
  transcriptOwnerIds: string[];
};

const EMPTY_FORM: ProjectFormState = {
  projectNumber: '',
  customerId: '',
  districtId: '',
  field1ValueId: '',
  field2ValueId: '',
  field3: '',
  field4: '',
  travellingCharges: 'non_billable',
  status: 'open',
  transcriptOwnerIds: [],
};

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('projectSaveError');
}

function projectStatusLabelKey(status: ProjectStatus): TranslationKey {
  return status === 'closed' ? 'projectStatusClosed' : 'projectStatusOpen';
}

function isFieldVisible(status: CustomerFieldStatus): boolean {
  return status !== 'invisible';
}

function isFieldMandatory(status: CustomerFieldStatus): boolean {
  return status === 'visible_mandatory';
}

export default function ProjectDetailsForm({
  mode,
  projectId,
  scrollToTranscriptOwners = false,
  onCancel,
  onSaved,
  onTranscriptOwnersChanged,
}: ProjectDetailsFormProps) {
  const { t } = useLanguage();
  const transcriptOwnersRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ownerSuccess, setOwnerSuccess] = useState('');
  const [showAddOwnerDialog, setShowAddOwnerDialog] = useState(false);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [transcriptOwners, setTranscriptOwners] = useState<ProjectTranscriptOwner[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [field1Options, setField1Options] = useState<CustomerFieldValue[]>([]);
  const [field2Options, setField2Options] = useState<CustomerFieldValue[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCustomers(), fetchDistrictOptions()])
      .then(([customerOptions, districtOptions]) => {
        if (!active) return;
        setCustomers(customerOptions);
        setDistricts(districtOptions);
      })
      .catch(() => {
        if (active) setError(t('projectLoadError'));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (mode !== 'edit' || !projectId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchProjectById(projectId)
      .then(async (project) => {
        if (!active) return;
        const customerData = await fetchCustomerById(project.customerId);
        const [options1, options2] = await Promise.all([
          fetchCustomerFieldValues(project.customerId, 1),
          fetchCustomerFieldValues(project.customerId, 2),
        ]);
        if (!active) return;

        setCustomer(customerData);
        setField1Options(options1);
        setField2Options(options2);
        setForm({
          projectNumber: project.projectNumber,
          customerId: project.customerId,
          districtId: project.districtId,
          field1ValueId: project.field1ValueId ?? '',
          field2ValueId: project.field2ValueId ?? '',
          field3: project.field3,
          field4: project.field4,
          travellingCharges: project.travellingCharges,
          status: project.status,
          transcriptOwnerIds: project.transcriptOwnerIds,
        });
        setTranscriptOwners(project.transcriptOwners);
      })
      .catch(() => {
        if (active) setError(t('projectLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, projectId, t]);

  useEffect(() => {
    if (!scrollToTranscriptOwners || loading) return;
    transcriptOwnersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToTranscriptOwners, loading]);

  useEffect(() => {
    if (mode !== 'create' || !form.customerId) {
      if (mode === 'create' && !form.customerId) {
        setCustomer(null);
        setField1Options([]);
        setField2Options([]);
      }
      return;
    }

    let active = true;
    setError('');

    Promise.all([
      fetchCustomerById(form.customerId),
      fetchCustomerFieldValues(form.customerId, 1),
      fetchCustomerFieldValues(form.customerId, 2),
    ])
      .then(([customerData, options1, options2]) => {
        if (!active) return;
        setCustomer(customerData);
        setField1Options(options1);
        setField2Options(options2);
        setForm((current) => ({
          ...current,
          field1ValueId: '',
          field2ValueId: '',
          field3: '',
          field4: '',
          travellingCharges: customerData.travellingCharges,
          transcriptOwnerIds: [],
        }));
        setTranscriptOwners([]);
      })
      .catch(() => {
        if (active) setError(t('projectLoadError'));
      });

    return () => {
      active = false;
    };
  }, [mode, form.customerId]);

  const validateClient = (): string | null => {
    if (!form.customerId) return t('projectCustomerRequired');
    if (!form.districtId) return t('projectDistrictRequired');

    if (customer) {
      if (isFieldMandatory(customer.field1Status) && !form.field1ValueId) {
        return t('projectField1Required');
      }
      if (isFieldMandatory(customer.field2Status) && !form.field2ValueId) {
        return t('projectField2Required');
      }
      if (isFieldMandatory(customer.field3Status) && !form.field3.trim()) {
        return t('projectField3Required');
      }
      if (isFieldMandatory(customer.field4Status) && !form.field4.trim()) {
        return t('projectField4Required');
      }
    }

    if (form.transcriptOwnerIds.length === 0) {
      return t('projectTranscriptOwnerRequired');
    }

    return null;
  };

  const buildPayload = (): ProjectPayload => ({
    customerId: form.customerId,
    districtId: form.districtId,
    field1ValueId: form.field1ValueId || null,
    field2ValueId: form.field2ValueId || null,
    field3: form.field3.trim(),
    field4: form.field4.trim(),
    travellingCharges: form.travellingCharges,
    status: form.status,
    transcriptOwnerIds: form.transcriptOwnerIds,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await createProject(payload);
        onSaved(t('projectCreatedSuccess'));
      } else if (projectId) {
        await updateProject(projectId, payload);
        onSaved(t('projectUpdatedSuccess'));
      }
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleAddTranscriptOwner = async (user: TranscriptOwnerCandidate) => {
    const newIds = [...form.transcriptOwnerIds, user.id];
    const newOwner: ProjectTranscriptOwner = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
    };

    if (mode === 'edit' && projectId) {
      const payload: ProjectPayload = {
        customerId: form.customerId,
        districtId: form.districtId,
        field1ValueId: form.field1ValueId || null,
        field2ValueId: form.field2ValueId || null,
        field3: form.field3.trim(),
        field4: form.field4.trim(),
        travellingCharges: form.travellingCharges,
        status: form.status,
        transcriptOwnerIds: newIds,
      };
      await updateProject(projectId, payload);
      onTranscriptOwnersChanged?.();
    }

    setForm((current) => ({ ...current, transcriptOwnerIds: newIds }));
    setTranscriptOwners((current) => [...current, newOwner]);
    setOwnerSuccess(t('projectTranscriptOwnerAddedSuccess'));
    setError('');
  };

  const handleDeleteTranscriptOwner = async (owner: ProjectTranscriptOwner) => {
    const newIds = form.transcriptOwnerIds.filter((id) => id !== owner.id);
    if (newIds.length === 0) {
      throw new Error(JSON.stringify({ errors: ['projectTranscriptOwnerRequired'] }));
    }

    if (mode === 'edit' && projectId) {
      const payload: ProjectPayload = {
        customerId: form.customerId,
        districtId: form.districtId,
        field1ValueId: form.field1ValueId || null,
        field2ValueId: form.field2ValueId || null,
        field3: form.field3.trim(),
        field4: form.field4.trim(),
        travellingCharges: form.travellingCharges,
        status: form.status,
        transcriptOwnerIds: newIds,
      };
      await updateProject(projectId, payload);
      onTranscriptOwnersChanged?.();
    }

    setForm((current) => ({ ...current, transcriptOwnerIds: newIds }));
    setTranscriptOwners((current) => current.filter((row) => row.id !== owner.id));
    setOwnerSuccess(t('projectTranscriptOwnerDeletedSuccess'));
    setError('');
  };

  const selectedCustomerName = useMemo(() => {
    if (customer) return customer.name;
    return customers.find((row) => row.id === form.customerId)?.name ?? '';
  }, [customer, customers, form.customerId]);

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  return (
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {mode === 'create' ? t('projectDetailsCreateTitle') : t('projectDetailsEditTitle')}
            </h2>
          </div>

          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {ownerSuccess && (
            <div className="profile-alert profile-alert-success">{ownerSuccess}</div>
          )}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="project-number">
              {t('projectNumber')}
            </label>
            <input
              id="project-number"
              className="profile-input profile-input-readonly"
              value={mode === 'create' ? t('projectNumberAuto') : form.projectNumber}
              readOnly
            />

            <label className="profile-label" htmlFor="project-customer">
              {t('customer')} *
            </label>
            {mode === 'create' ? (
              <select
                id="project-customer"
                className="profile-input"
                value={form.customerId}
                onChange={(e) => updateField('customerId', e.target.value)}
              >
                <option value="">{t('selectOption')}</option>
                {customers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="project-customer"
                className="profile-input profile-input-readonly"
                value={selectedCustomerName}
                readOnly
              />
            )}

            <label className="profile-label" htmlFor="project-district">
              {t('district')} *
            </label>
            <select
              id="project-district"
              className="profile-input"
              value={form.districtId}
              onChange={(e) => updateField('districtId', e.target.value)}
            >
              <option value="">{t('selectOption')}</option>
              {districts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>

            {customer && isFieldVisible(customer.field1Status) && (
              <>
                <label className="profile-label" htmlFor="project-field-1">
                  {customer.field1Name || t('fieldNumberLabel').replace('{number}', '1')}
                  {isFieldMandatory(customer.field1Status) ? ' *' : ''}
                </label>
                <select
                  id="project-field-1"
                  className="profile-input"
                  value={form.field1ValueId}
                  onChange={(e) => updateField('field1ValueId', e.target.value)}
                >
                  <option value="">{t('selectOption')}</option>
                  {field1Options.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.value}
                    </option>
                  ))}
                </select>
              </>
            )}

            {customer && isFieldVisible(customer.field2Status) && (
              <>
                <label className="profile-label" htmlFor="project-field-2">
                  {customer.field2Name || t('fieldNumberLabel').replace('{number}', '2')}
                  {isFieldMandatory(customer.field2Status) ? ' *' : ''}
                </label>
                <select
                  id="project-field-2"
                  className="profile-input"
                  value={form.field2ValueId}
                  onChange={(e) => updateField('field2ValueId', e.target.value)}
                >
                  <option value="">{t('selectOption')}</option>
                  {field2Options.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.value}
                    </option>
                  ))}
                </select>
              </>
            )}

            {customer && isFieldVisible(customer.field3Status) && (
              <>
                <label className="profile-label" htmlFor="project-field-3">
                  {customer.field3Name || t('fieldNumberLabel').replace('{number}', '3')}
                  {isFieldMandatory(customer.field3Status) ? ' *' : ''}
                </label>
                <input
                  id="project-field-3"
                  className="profile-input"
                  value={form.field3}
                  onChange={(e) => updateField('field3', e.target.value)}
                />
              </>
            )}

            {customer && isFieldVisible(customer.field4Status) && (
              <>
                <label className="profile-label" htmlFor="project-field-4">
                  {customer.field4Name || t('fieldNumberLabel').replace('{number}', '4')}
                  {isFieldMandatory(customer.field4Status) ? ' *' : ''}
                </label>
                <input
                  id="project-field-4"
                  className="profile-input"
                  value={form.field4}
                  onChange={(e) => updateField('field4', e.target.value)}
                />
              </>
            )}

            <label className="profile-label" htmlFor="project-travelling-charges">
              {t('travellingCharges')}
            </label>
            <select
              id="project-travelling-charges"
              className="profile-input"
              value={form.travellingCharges}
              onChange={(e) =>
                updateField('travellingCharges', e.target.value as TravellingCharges)
              }
            >
              {TRAVELLING_CHARGES_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(travellingChargesLabelKey(option))}
                </option>
              ))}
            </select>

            <label className="profile-label" htmlFor="project-status">
              {t('status')} *
            </label>
            <select
              id="project-status"
              className="profile-input"
              value={form.status}
              onChange={(e) => updateField('status', e.target.value as ProjectStatus)}
            >
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(projectStatusLabelKey(option))}
                </option>
              ))}
            </select>
          </div>

          <div ref={transcriptOwnersRef} id="project-transcript-owners">
            <ProjectTranscriptOwnersList
              owners={transcriptOwners}
              canManage={Boolean(form.customerId)}
              successMessage={ownerSuccess}
              onAdd={() => {
                setOwnerSuccess('');
                setShowAddOwnerDialog(true);
              }}
              onDelete={handleDeleteTranscriptOwner}
            />
          </div>

          <div className="profile-actions">
            <button type="button" className="profile-cancel-btn" onClick={onCancel}>
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="profile-submit"
              disabled={saving || (mode === 'create' && !form.customerId)}
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>

      {showAddOwnerDialog && form.customerId && (
        <AddTranscriptOwnerDialog
          customerId={form.customerId}
          assignedOwnerIds={form.transcriptOwnerIds}
          onClose={() => setShowAddOwnerDialog(false)}
          onAdd={handleAddTranscriptOwner}
        />
      )}
    </div>
  );
}
