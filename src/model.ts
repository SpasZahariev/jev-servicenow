export const catalogs = {
  requested_by: [
    {
      id: 'spas-zahariev',
      name: 'Spas Zahariev',
      detail: 'spas.zahariev@example.com',
      meta: 'Engineering',
    },
    {
      id: 'alex-morgan',
      name: 'Alex Morgan',
      detail: 'alex.morgan@example.com',
      meta: 'Engineering',
    },
    { id: 'sarah-chen', name: 'Sarah Chen', detail: 'sarah.chen@example.com', meta: 'Platform' },
    {
      id: 'james-wilson',
      name: 'James Wilson',
      detail: 'james.wilson@example.com',
      meta: 'Operations',
    },
  ],
  assignment_group: [
    {
      id: 'data-platform',
      name: 'Data Platform',
      detail: 'Data services and pipelines',
      meta: 'Engineering',
    },
    {
      id: 'application-development',
      name: 'Application Development',
      detail: 'Business applications',
      meta: 'Engineering',
    },
    {
      id: 'cloud-operations',
      name: 'Cloud Operations',
      detail: 'Infrastructure and deployment',
      meta: 'Operations',
    },
    {
      id: 'client-solutions',
      name: 'Client Solutions',
      detail: 'Client-facing software',
      meta: 'Engineering',
    },
  ],
  release_manager: [
    {
      id: 'taylor-reed',
      name: 'Taylor Reed',
      detail: 'taylor.reed@example.com',
      meta: 'Release Management',
    },
    { id: 'sarah-chen', name: 'Sarah Chen', detail: 'sarah.chen@example.com', meta: 'Platform' },
    {
      id: 'alex-morgan',
      name: 'Alex Morgan',
      detail: 'alex.morgan@example.com',
      meta: 'Engineering',
    },
    {
      id: 'james-wilson',
      name: 'James Wilson',
      detail: 'james.wilson@example.com',
      meta: 'Operations',
    },
  ],
  components: [
    {
      id: 'clients-pillar-ai',
      name: 'Clients Pillar AI Incubator',
      detail: 'Client intelligence application',
      meta: 'Application',
    },
    {
      id: 'release-orchestrator',
      name: 'Release Orchestrator',
      detail: 'Deployment coordination service',
      meta: 'Service',
    },
    {
      id: 'client-portal',
      name: 'Client Portal',
      detail: 'Client self-service web application',
      meta: 'Application',
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      detail: 'Data ingestion and processing',
      meta: 'Service',
    },
    {
      id: 'identity-service',
      name: 'Identity Service',
      detail: 'Authentication and authorization',
      meta: 'Service',
    },
    {
      id: 'reporting-api',
      name: 'Reporting API',
      detail: 'Portfolio reporting endpoints',
      meta: 'API',
    },
  ],
  repositories: [
    {
      id: 'clients-pillar-ai',
      name: 'clients/ai-incubator',
      detail: 'gitlab.example.com/clients/ai-incubator',
      meta: 'main',
    },
    {
      id: 'release-orchestrator',
      name: 'platform/release-orchestrator',
      detail: 'gitlab.example.com/platform/release-orchestrator',
      meta: 'main',
    },
    {
      id: 'client-portal',
      name: 'clients/client-portal',
      detail: 'gitlab.example.com/clients/client-portal',
      meta: 'main',
    },
    {
      id: 'data-pipeline',
      name: 'data/data-pipeline',
      detail: 'gitlab.example.com/data/data-pipeline',
      meta: 'main',
    },
    {
      id: 'identity-service',
      name: 'platform/identity-service',
      detail: 'gitlab.example.com/platform/identity-service',
      meta: 'main',
    },
    {
      id: 'reporting-api',
      name: 'data/reporting-api',
      detail: 'gitlab.example.com/data/reporting-api',
      meta: 'main',
    },
  ],
};
export type CatalogKey = keyof typeof catalogs;
export type RecordItem = (typeof catalogs.requested_by)[number];
export type Tab = 'planning' | 'risk' | 'activities';
export const tabs: { id: Tab; label: string }[] = [
  { id: 'planning', label: 'Schedule and Planning' },
  { id: 'risk', label: 'Risk and Impact' },
  { id: 'activities', label: 'Activities' },
];
export const stages = [
  'Draft',
  'Confirm Release',
  'Approval',
  'Implementing',
  'Implemented',
  'Closed',
];
export const initialForm = {
  number: 'CHG014334',
  requested_by: 'spas-zahariev',
  type: 'Standard',
  category: 'Application',
  change_impact: '',
  assignment_group: '',
  release_manager: 'taylor-reed',
  release_manager_deputy: '',
  lux_related: '',
  lux_approval: '',
  emergency_reason: '',
  components: [] as string[],
  repositories: [] as string[],
  short_description: '',
  description: '',
  release_version: '',
  environment: 'Production',
  implementation_start: '',
  implementation_end: '',
  change_plan: '',
  rollback_plan: '',
  test_plan: '',
  risk_level: '',
  risk_analysis: '',
  customer_impact: 'No',
  outage_required: false,
  outage_minutes: '',
  communication_plan: '',
  security_review: false,
  security_reference: '',
};
export type FormData = typeof initialForm;
export type FieldKey = keyof FormData;
export const labels: Record<FieldKey, string> = {
  number: 'Number',
  requested_by: 'Requested by',
  type: 'Type',
  category: 'Category',
  change_impact: 'Change impact',
  assignment_group: 'Assignment group',
  release_manager: 'Release manager',
  release_manager_deputy: 'Release manager deputy',
  lux_related: 'LUX related',
  lux_approval: 'LUX approval reference',
  emergency_reason: 'Emergency justification',
  components: 'Components',
  repositories: 'GitLab repositories',
  short_description: 'Short description',
  description: 'Description',
  release_version: 'Release version',
  environment: 'Environment',
  implementation_start: 'Implementation start date',
  implementation_end: 'Implementation end date',
  change_plan: 'Change plan',
  rollback_plan: 'Rollback plan',
  test_plan: 'Test plan',
  risk_level: 'Risk level',
  risk_analysis: 'Risk and impact analysis',
  customer_impact: 'Customer impact',
  outage_required: 'Service outage required',
  outage_minutes: 'Expected outage duration',
  communication_plan: 'Communication plan',
  security_review: 'Security review required',
  security_reference: 'Security review reference',
};
export const fieldTabs: Partial<Record<FieldKey, Tab>> = Object.fromEntries([
  ...[
    'release_version',
    'environment',
    'implementation_start',
    'implementation_end',
    'change_plan',
    'rollback_plan',
    'test_plan',
  ].map((k) => [k, 'planning']),
  ...[
    'risk_level',
    'risk_analysis',
    'customer_impact',
    'outage_required',
    'outage_minutes',
    'communication_plan',
    'security_review',
    'security_reference',
  ].map((k) => [k, 'risk']),
]);
export function requiredFields(data: FormData): FieldKey[] {
  const fields: FieldKey[] = [
    'requested_by',
    'change_impact',
    'assignment_group',
    'release_manager',
    'release_manager_deputy',
    'lux_related',
    'components',
    'repositories',
    'short_description',
    'description',
    'release_version',
    'implementation_start',
    'implementation_end',
    'change_plan',
    'rollback_plan',
    'test_plan',
    'risk_level',
    'risk_analysis',
  ];
  if (data.lux_related === 'Yes') fields.push('lux_approval');
  if (data.type === 'Emergency') fields.push('emergency_reason');
  if (data.outage_required) fields.push('outage_minutes');
  if (data.customer_impact === 'Yes' || data.risk_level === 'High')
    fields.push('communication_plan');
  if (data.security_review) fields.push('security_reference');
  return fields;
}
export function validate(data: FormData): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  for (const key of requiredFields(data)) {
    const value = data[key];
    if (Array.isArray(value) ? value.length === 0 : !String(value).trim())
      errors[key] = `${labels[key]} is required.`;
  }
  const references: [FieldKey, CatalogKey][] = [
    ['requested_by', 'requested_by'],
    ['assignment_group', 'assignment_group'],
    ['release_manager', 'release_manager'],
    ['release_manager_deputy', 'release_manager'],
  ];
  for (const [key, catalog] of references) {
    if (data[key] && !catalogs[catalog].some((item) => item.id === data[key]))
      errors[key] = 'Select a valid record using the lookup.';
  }
  for (const key of ['components', 'repositories'] as const) {
    if (data[key].some((id) => !catalogs[key].some((item) => item.id === id)))
      errors[key] = 'Remove invalid records and select from the lookup.';
  }
  if (data.release_manager && data.release_manager === data.release_manager_deputy)
    errors.release_manager_deputy = 'Choose a deputy different from the release manager.';
  if (
    data.implementation_start &&
    data.implementation_end &&
    data.implementation_end <= data.implementation_start
  )
    errors.implementation_end = 'End date must be after the start date.';
  if (
    data.outage_required &&
    (!Number.isInteger(Number(data.outage_minutes)) || Number(data.outage_minutes) < 1)
  )
    errors.outage_minutes = 'Enter a whole number of minutes greater than zero.';
  return errors;
}
export type Activity = { id: string; text: string; time: string; kind: 'system' | 'note' };
export type Attachment = { id: string; name: string; size: number; type: string };
export type Draft = {
  form: FormData;
  stage: number;
  activities: Activity[];
  attachments: Attachment[];
};
const demoRun = new URLSearchParams(window.location.search).get('demo_run');
export const storageKey =
  demoRun && /^[a-zA-Z0-9-]{1,64}$/.test(demoRun)
    ? `snow-release-demo:v1:demo:${demoRun}`
    : 'snow-release-demo:v1';
export function readDraft(): Draft {
  const empty = { form: { ...initialForm }, stage: 0, activities: [], attachments: [] };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.form !== 'object' ||
      !Number.isInteger(parsed.stage) ||
      parsed.stage < 0 ||
      parsed.stage >= stages.length
    )
      return empty;
    const form = { ...initialForm };
    for (const key of Object.keys(initialForm) as FieldKey[]) {
      const value = parsed.form[key];
      if (
        typeof value === typeof initialForm[key] &&
        (!Array.isArray(initialForm[key]) ||
          (Array.isArray(value) && value.every((entry: unknown) => typeof entry === 'string')))
      ) {
        Object.assign(form, { [key]: value });
      }
    }
    let restoredStage = parsed.stage;
    for (const key of ['release_manager', 'release_manager_deputy'] as const) {
      if (form[key] && !catalogs.release_manager.some((record) => record.id === form[key])) {
        form[key] = initialForm[key];
        restoredStage = 0;
      }
    }
    const activities = Array.isArray(parsed.activities)
      ? parsed.activities.filter(
          (a: Activity) =>
            a &&
            typeof a.id === 'string' &&
            typeof a.text === 'string' &&
            typeof a.time === 'string' &&
            ['note', 'system'].includes(a.kind),
        )
      : [];
    const attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.filter(
          (a: Attachment) =>
            a &&
            typeof a.id === 'string' &&
            typeof a.name === 'string' &&
            typeof a.size === 'number' &&
            typeof a.type === 'string',
        )
      : [];
    return { form, stage: restoredStage, activities, attachments };
  } catch {
    return empty;
  }
}
