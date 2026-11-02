import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Grid2X2,
  Info,
  ListFilter,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import {
  catalogs,
  fieldTabs,
  initialForm,
  labels,
  readDraft,
  requiredFields,
  stages,
  storageKey,
  tabs,
  validate,
  type Activity,
  type Attachment,
  type CatalogKey,
  type FieldKey,
  type FormData,
  type Tab,
} from './model';

type Lookup = { field: FieldKey; catalog: CatalogKey; multiple: boolean };
type Errors = Partial<Record<FieldKey, string>>;

function Dialog({
  title,
  id,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  id: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [previousFocus] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus();
    return () => {
      dialog.close();
      queueMicrotask(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
      });
    };
  }, [previousFocus]);
  return (
    <dialog
      ref={ref}
      id={id}
      className={wide ? 'dialog wide' : 'dialog'}
      aria-labelledby={`${id}-title`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">CHANGE MANAGEMENT</span>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          id={`${id}-close`}
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function LookupDialog({
  lookup,
  value,
  onSelect,
  onClose,
}: {
  lookup: Lookup;
  value: string | string[];
  onSelect: (value: string | string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(value) ? value : value ? [value] : [],
  );
  const [filter, setFilter] = useState('all');
  const records = catalogs[lookup.catalog];
  const results = records.filter(
    (item) =>
      (filter === 'all' || item.meta === filter) &&
      `${item.name} ${item.detail} ${item.meta}`.toLowerCase().includes(query.toLowerCase()),
  );
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  return (
    <Dialog
      id={`lookup-${lookup.field}`}
      title={`Select ${labels[lookup.field].toLowerCase()}`}
      onClose={onClose}
      wide
    >
      <div className="lookup-tools">
        <div className="search-input">
          <Search size={17} />
          <input
            data-dialog-autofocus
            id={`${lookup.field}-modal-search`}
            name={`${lookup.field}_search`}
            data-testid={`${lookup.field}-modal-search`}
            aria-label={`Search ${labels[lookup.field]}`}
            placeholder="Search by name or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          id={`${lookup.field}-modal-filter`}
          aria-label="Filter records"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All records</option>
          {[...new Set(records.map((item) => item.meta))].map((meta) => (
            <option key={meta}>{meta}</option>
          ))}
        </select>
      </div>
      <div className="lookup-meta">
        <span>{results.length} records found</span>
        <span>
          {lookup.multiple ? 'Select one or more records' : 'Select a record to continue'}
        </span>
      </div>
      <div className="lookup-table-wrap">
        <table className="lookup-table">
          <thead>
            <tr>
              {lookup.multiple && (
                <th className="check-col">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th>Name</th>
              <th>Description</th>
              <th>Group / type</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => (
              <tr key={item.id} data-record-id={item.id} data-record-name={item.name}>
                {lookup.multiple && (
                  <td>
                    <input
                      type="checkbox"
                      id={`select-${lookup.field}-${item.id}`}
                      aria-label={`Select ${item.name}`}
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                  </td>
                )}
                <td>
                  {lookup.multiple ? (
                    <label htmlFor={`select-${lookup.field}-${item.id}`}>{item.name}</label>
                  ) : (
                    <button
                      type="button"
                      className="record-link"
                      id={`select-${lookup.field}-${item.id}`}
                      data-action="select-record"
                      onClick={() => onSelect(item.id)}
                    >
                      {item.name}
                    </button>
                  )}
                </td>
                <td>{item.detail}</td>
                <td>
                  <span className="tag">{item.meta}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <div className="empty-search">
            <Search size={24} />
            <strong>No matching records</strong>
            <span>Try another name or clear the filter.</span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <span>
          {lookup.multiple
            ? `${selected.length} selected`
            : 'Reference records are local demo data.'}
        </span>
        <div className="button-group">
          <button
            type="button"
            className="button"
            onClick={onClose}
            id={`${lookup.field}-lookup-cancel`}
          >
            Cancel
          </button>
          {lookup.multiple && (
            <button
              type="button"
              className="button primary"
              id={`${lookup.field}-lookup-apply`}
              onClick={() => onSelect(selected)}
            >
              Add selected{selected.length > 0 ? ` (${selected.length})` : ''}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default function App() {
  const [draft] = useState(readDraft);
  const [form, setForm] = useState<FormData>(draft.form);
  const [stage, setStage] = useState(draft.stage);
  const [tab, setTab] = useState<Tab>('planning');
  const [errors, setErrors] = useState<Errors>({});
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [activities, setActivities] = useState<Activity[]>(draft.activities);
  const [attachments, setAttachments] = useState<Attachment[]>(draft.attachments);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [referenceFilters, setReferenceFilters] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const requirements = requiredFields(form);
  const currentErrors = validate(form);
  const complete = requirements.filter((key) => !currentErrors[key]).length;
  const progress = Math.round((complete / requirements.length) * 100);
  const status = [
    'New',
    'Ready for review',
    'Awaiting approval',
    'In progress',
    'Implemented',
    'Closed',
  ][stage];

  function update<K extends FieldKey>(key: K, value: FormData[K]) {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setErrors((prev) => {
      const remaining = validate(nextForm);
      return Object.fromEntries(
        Object.keys(prev)
          .filter((k) => remaining[k as FieldKey])
          .map((k) => [k, remaining[k as FieldKey]]),
      );
    });
    setSaved(false);
    if (stage > 0) {
      setStage(0);
      setNotice('The release was changed and returned to Draft. Submit it again when ready.');
    }
  }
  function addActivity(text: string, kind: Activity['kind'] = 'system') {
    const entry = { id: crypto.randomUUID(), text, time: new Date().toISOString(), kind };
    setActivities((prev) => [entry, ...prev]);
    return entry;
  }
  function persist(nextStage = stage, nextActivities = activities) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ form, stage: nextStage, activities: nextActivities, attachments }),
      );
      setSaved(true);
      return true;
    } catch {
      setNotice('Your browser could not save this draft. Export JSON to keep a copy.');
      return false;
    }
  }
  function save() {
    const entry = addActivity('Draft saved locally.');
    if (persist(stage, [entry, ...activities])) setNotice('Draft saved in this browser.');
  }
  function focusField(key: FieldKey) {
    if (fieldTabs[key]) setTab(fieldTabs[key]!);
    requestAnimationFrame(() => {
      document.getElementById(key)?.focus();
      document
        .getElementById(`field-${key}`)
        ?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  function checkForm() {
    const result = validate(form);
    setErrors(result);
    const first = Object.keys(result)[0] as FieldKey | undefined;
    if (first) {
      setNotice('Complete the required fields before continuing.');
      focusField(first);
      return false;
    }
    return true;
  }
  function advance(action: 'submit' | 'start') {
    if (!checkForm()) return;
    if (action === 'start' && stage === 0) {
      setNotice('Submit the release before starting the change.');
      return;
    }
    const next = Math.min(stage + 1, stages.length - 1);
    setStage(next);
    const entry = addActivity(`Release moved to ${stages[next]}.`);
    persist(next, [entry, ...activities]);
    setNotice(
      next === 1
        ? 'Release submitted. Review the details and confirm the release.'
        : `Release is now in ${stages[next]}. This is a local demo; no external change was created.`,
    );
  }
  function exportJson() {
    const payload = {
      schema_version: 1,
      record_type: 'software_component_release',
      form,
      stage: stages[stage],
      status,
      attachments,
      activities,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.number}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Release exported as JSON.');
  }
  function choose(value: string | string[]) {
    if (!lookup) return;
    const key = lookup.field;
    update(key, value as never);
    setReferenceFilters((prev) => ({ ...prev, [key]: '' }));
    setLookup(null);
  }
  function attrs(key: FieldKey) {
    return {
      id: key,
      name: key,
      'data-testid': key,
      'data-field': key,
      'data-field-label': labels[key],
      'data-section': fieldTabs[key] ?? 'details',
      'aria-required': requirements.includes(key),
      'aria-invalid': !!errors[key],
      'aria-describedby': errors[key] ? `${key}-error` : undefined,
    };
  }
  function field(key: FieldKey, input: ReactNode, hint?: string, className = '') {
    return (
      <div
        id={`field-${key}`}
        className={`field ${errors[key] ? 'has-error' : ''} ${className}`}
        data-required={requirements.includes(key)}
      >
        <label htmlFor={key}>
          {requirements.includes(key) && (
            <span className="required" aria-hidden="true">
              *
            </span>
          )}
          {labels[key]}
          {hint && <CircleHelp size={13} aria-hidden="true" className="field-help" />}
        </label>
        <div className="field-control">
          {input}
          {hint && (
            <span id={`${key}-hint`} className="field-hint">
              {hint}
            </span>
          )}
          {errors[key] && (
            <span className="field-error" role="alert" id={`${key}-error`}>
              {errors[key]}
            </span>
          )}
        </div>
      </div>
    );
  }
  function text(key: FieldKey, placeholder = '', type = 'text', hint?: string, readOnly = false) {
    return field(
      key,
      <input
        {...attrs(key)}
        type={type}
        value={String(form[key])}
        placeholder={placeholder}
        readOnly={readOnly}
        min={type === 'number' ? 1 : undefined}
        step={type === 'number' ? 1 : undefined}
        maxLength={key === 'short_description' ? 160 : undefined}
        onChange={(e) => update(key, e.target.value as never)}
      />,
      hint,
    );
  }
  function select(key: FieldKey, options: string[], hint?: string) {
    return field(
      key,
      <select
        {...attrs(key)}
        value={String(form[key])}
        onChange={(e) => update(key, e.target.value as never)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || '-- None --'}
          </option>
        ))}
      </select>,
      hint,
    );
  }
  function textarea(key: FieldKey, placeholder: string, rows = 4, hint?: string) {
    return field(
      key,
      <>
        <textarea
          {...attrs(key)}
          data-input-kind="generated-text"
          rows={rows}
          value={String(form[key])}
          placeholder={placeholder}
          onChange={(e) => update(key, e.target.value as never)}
        />
        <span className="character-count">
          {String(form[key]).length.toLocaleString()} characters
        </span>
      </>,
      hint,
      'full-width textarea-field',
    );
  }
  function reference(key: FieldKey, catalog: CatalogKey) {
    const record = catalogs[catalog].find((item) => item.id === form[key]);
    const display = record?.name ?? String(form[key]);
    const exactMatches = (value: string) =>
      catalogs[catalog].find(
        (item) => item.name.toLowerCase() === value.toLowerCase() || item.id === value,
      );
    return field(
      key,
      <div className="reference-input" data-reference-id={record?.id ?? ''}>
        <input
          {...attrs(key)}
          data-input-kind="reference"
          data-catalog={catalog}
          value={display}
          list={`${key}-suggestions`}
          autoComplete="off"
          placeholder="Search or select a record"
          onChange={(e) => update(key, exactMatches(e.target.value)?.id ?? e.target.value)}
        />
        <datalist id={`${key}-suggestions`}>
          {catalogs[catalog].map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
        <button
          type="button"
          id={`${key}-lookup`}
          data-action="open-lookup"
          aria-label={`Look up ${labels[key]}`}
          className="lookup-button"
          onClick={() => setLookup({ field: key, catalog, multiple: false })}
        >
          <Search size={16} />
        </button>
      </div>,
    );
  }
  function multiReference(key: 'components' | 'repositories') {
    const query = referenceFilters[key] ?? '';
    const selected = catalogs[key].filter(
      (item) =>
        form[key].includes(item.id) && item.name.toLowerCase().includes(query.toLowerCase()),
    );
    return (
      <div
        id={`field-${key}`}
        className={`multi-field ${errors[key] ? 'has-error' : ''}`}
        data-required="true"
      >
        <div className="multi-label">
          <label id={`${key}-label`} htmlFor={key}>
            <span className="required">*</span>
            {labels[key]} <CircleHelp size={13} />
          </label>
          <span className="count-badge">{form[key].length} selected</span>
        </div>
        <div
          className="selection-box"
          id={key}
          role="group"
          tabIndex={-1}
          aria-labelledby={`${key}-label`}
          aria-describedby={errors[key] ? `${key}-error` : `${key}-hint`}
          data-field={key}
          data-testid={key}
          data-field-label={labels[key]}
          data-input-kind="multi-reference"
          data-selected-ids={JSON.stringify(form[key])}
          aria-invalid={!!errors[key]}
        >
          {selected.map((item) => (
            <div className="selected-record" key={item.id} data-record-id={item.id}>
              <div className="record-icon">
                {key === 'components' ? <Grid2X2 size={16} /> : <FileText size={16} />}
              </div>
              <div>
                <strong>{item.name}</strong>
                <small>{item.detail}</small>
              </div>
              <button
                type="button"
                id={`remove-${key}-${item.id}`}
                aria-label={`Remove ${item.name}`}
                className="icon-button"
                onClick={() =>
                  update(
                    key,
                    form[key].filter((id) => id !== item.id),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
          {selected.length === 0 && (
            <div className="selection-empty">
              {key === 'components' ? <Grid2X2 size={21} /> : <FileText size={21} />}
              <span>
                {form[key].length
                  ? 'No selected records match your search'
                  : `No ${key === 'components' ? 'components' : 'repositories'} selected`}
              </span>
              <small>
                {form[key].length
                  ? 'Clear the search to see all selected records.'
                  : 'Use the lookup below to add records.'}
              </small>
            </div>
          )}
        </div>
        <div className="reference-input">
          <input
            id={`${key}-search`}
            aria-label={`Filter selected ${labels[key]}`}
            name={`${key}_filter`}
            placeholder="Filter selected records"
            value={query}
            onChange={(e) => setReferenceFilters((prev) => ({ ...prev, [key]: e.target.value }))}
          />
          <button
            type="button"
            id={`${key}-lookup`}
            data-action="open-lookup"
            className="lookup-button"
            aria-label={`Look up ${labels[key]}`}
            onClick={() => setLookup({ field: key, catalog: key, multiple: true })}
          >
            <Search size={16} />
          </button>
        </div>
        <span id={`${key}-hint`} className="field-hint">
          Select one or more{' '}
          {key === 'components'
            ? 'software components affected by this release'
            : 'repositories containing the release changes'}
          .
        </span>
        {errors[key] && (
          <span id={`${key}-error`} className="field-error" role="alert">
            {errors[key]}
          </span>
        )}
        {form[key].map((id) => (
          <input type="hidden" key={id} name={key} value={id} />
        ))}
      </div>
    );
  }
  function checkbox(key: 'outage_required' | 'security_review', hint: string) {
    return field(
      key,
      <label className="checkbox-label">
        <input
          {...attrs(key)}
          type="checkbox"
          checked={form[key]}
          onChange={(e) => update(key, e.target.checked)}
        />
        <span>{hint}</span>
      </label>,
    );
  }
  function actions(location: string) {
    const submitLabel = [
      'Submit',
      'Confirm release',
      'Approve release',
      'Mark implemented',
      'Close change',
      'Closed',
    ][stage];
    return (
      <div className="button-group">
        <button
          type="button"
          className="button"
          id={`save-${location}`}
          data-action="save-draft"
          onClick={save}
        >
          Save
        </button>
        <button
          type="button"
          className="button"
          id={`start-change-${location}`}
          data-action="start-change"
          disabled={stage === 0 || stage >= 3}
          onClick={() => advance('start')}
        >
          Start Change
        </button>
        <button
          type="submit"
          className="button primary"
          id={`submit-${location}`}
          data-action="submit-release"
          disabled={stage === 5}
        >
          {submitLabel}
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }
  const errorKeys = Object.keys(errors) as FieldKey[];
  return (
    <>
      <header className="global-header">
        <a className="brand" href="#main-content" aria-label="Service Now Change Management">
          <span className="brand-mark">service now</span>
        </a>
        <div className="global-nav">
          <span className="nav-divider" />
          <span>All</span>
          <span>Favorites</span>
          <span>History</span>
        </div>
        <div className="global-title">
          <span className="status-dot" />
          Change Management
        </div>
        <div className="global-right">
          <span className="demo-pill">LOCAL DEMO</span>
          <button
            type="button"
            id="help"
            className="header-icon"
            aria-label="Help and automation guide"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={18} />
          </button>
          <button
            type="button"
            id="notifications"
            className="header-icon"
            aria-label="Show release notifications"
            onClick={() => {
              setTab('activities');
              document.getElementById('release-tabs')?.scrollIntoView();
            }}
          >
            <Bell size={18} />
          </button>
          <span className="avatar" title="Spas Zahariev">
            SZ
          </span>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar" aria-label="Form navigation">
          <a href="#main-content" className="rail-item" aria-label="Release overview">
            <Menu size={19} />
          </a>
          <a href="#release-details" className="rail-item active" aria-label="Release details">
            <ClipboardList size={20} />
          </a>
          <a href="#impacted-applications" className="rail-item" aria-label="Impacted applications">
            <Grid2X2 size={19} />
          </a>
          <a
            href="#release-tabs"
            className="rail-item"
            aria-label="Schedule and planning"
            onClick={() => setTab('planning')}
          >
            <Clock3 size={19} />
          </a>
          <a
            href="#release-tabs"
            className="rail-item"
            aria-label="Risk and impact"
            onClick={() => setTab('risk')}
          >
            <ShieldCheck size={20} />
          </a>
          <a
            href="#release-tabs"
            className="rail-item"
            aria-label="Activities"
            onClick={() => setTab('activities')}
          >
            <MessageSquare size={19} />
          </a>
          <div className="rail-bottom">
            <button
              className="rail-item"
              type="button"
              aria-label="Demo settings"
              onClick={() => setHelp(true)}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </aside>
        <main id="main-content">
          <form
            id="software-component-release"
            data-record-type="software_component_release"
            data-stage={stages[stage]}
            data-status={status}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              advance('submit');
            }}
          >
            <div className="record-header">
              <div className="record-title">
                <a
                  className="back-button"
                  href="#release-details"
                  aria-label="Back to release details"
                >
                  <ArrowLeft size={18} />
                </a>
                <div>
                  <nav className="breadcrumb" aria-label="Breadcrumb">
                    <a href="#main-content">Change Management</a>
                    <ChevronRight size={12} />
                    <span>Change Request</span>
                  </nav>
                  <h1>
                    New software component release{' '}
                    <button
                      type="button"
                      className={`favorite ${favorite ? 'is-favorite' : ''}`}
                      id="favorite-release"
                      aria-label="Favorite this release"
                      aria-pressed={favorite}
                      onClick={() => setFavorite(!favorite)}
                    >
                      <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
                    </button>
                  </h1>
                  <div className="record-subtitle">
                    <span>{form.number}</span>
                    <span className="tiny-dot" />
                    <span>New record</span>
                    <span className="tiny-dot" />
                    <span>View: Normal Application</span>
                  </div>
                </div>
              </div>
              <div className="record-actions">
                <button
                  type="button"
                  id="add-attachment"
                  className="icon-button"
                  aria-label="Add attachment"
                  onClick={() => uploadRef.current?.click()}
                >
                  <Paperclip size={18} />
                </button>
                {actions('header')}
              </div>
            </div>
            <div className="form-body">
              <ol className="stage-track" aria-label="Release workflow">
                {stages.map((name, index) => (
                  <li
                    key={name}
                    className={index === stage ? 'current' : index < stage ? 'done' : ''}
                    aria-current={index === stage ? 'step' : undefined}
                    data-stage={name}
                    data-stage-status={
                      index === stage ? 'current' : index < stage ? 'complete' : 'pending'
                    }
                  >
                    <span className="stage-number">
                      {index < stage ? <Check size={12} /> : index + 1}
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ol>
              <div className="form-meta">
                <span>
                  <Info size={14} />
                  Fields marked <b className="required">*</b> are required to submit.
                </span>
                <span className="completion">
                  <span className="progress-bar">
                    <i style={{ width: `${progress}%` }} />
                  </span>
                  {complete} of {requirements.length} required fields complete
                </span>
              </div>
              {notice && (
                <div className="notice" role="status">
                  <Info size={17} />
                  <span>{notice}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Dismiss notification"
                    onClick={() => setNotice('')}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {errorKeys.length > 0 && (
                <div className="error-summary" role="alert">
                  <strong>
                    {errorKeys.length} {errorKeys.length === 1 ? 'field needs' : 'fields need'}{' '}
                    attention
                  </strong>
                  <div>
                    {errorKeys.map((key) => (
                      <button type="button" key={key} onClick={() => focusField(key)}>
                        {labels[key]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <section id="release-details" aria-labelledby="details-title">
                <div className="section-heading">
                  <h2 id="details-title">Release details</h2>
                  <span className="section-note">Software component release</span>
                </div>
                <div className="details-grid">
                  <div className="field-column">
                    {text('number', '', 'text', undefined, true)}
                    {reference('requested_by', 'requested_by')}
                    {select('type', ['Standard', 'Normal', 'Emergency'])}
                    {select('category', ['Application', 'Infrastructure', 'Database', 'Security'])}
                    {select(
                      'change_impact',
                      ['', 'Low', 'Medium', 'High'],
                      'Expected impact on existing services.',
                    )}
                    {form.type === 'Emergency' && (
                      <div data-visible-when="type=Emergency">
                        {textarea(
                          'emergency_reason',
                          'Explain why this release cannot follow the standard schedule.',
                          3,
                        )}
                      </div>
                    )}
                  </div>
                  <div className="field-column">
                    <div className="field">
                      <label htmlFor="status">Status</label>
                      <div className="field-control">
                        <input
                          id="status"
                          name="status"
                          data-field="status"
                          data-testid="status"
                          readOnly
                          value={status}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="stage">Stage</label>
                      <div className="field-control">
                        <input
                          id="stage"
                          name="stage"
                          data-field="stage"
                          data-testid="stage"
                          readOnly
                          value={stages[stage]}
                        />
                      </div>
                    </div>
                    {reference('assignment_group', 'assignment_group')}
                    {reference('release_manager', 'release_manager')}
                    {reference('release_manager_deputy', 'release_manager')}
                    {select(
                      'lux_related',
                      ['', 'No', 'Yes'],
                      'Does this release affect Luxembourg-regulated services?',
                    )}
                    {form.lux_related === 'Yes' && (
                      <div data-visible-when="lux_related=Yes">
                        {text(
                          'lux_approval',
                          'e.g. LUX-2026-0042',
                          'text',
                          'Required for LUX-related releases.',
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
              <section id="impacted-applications" aria-labelledby="applications-title">
                <div className="section-heading">
                  <h2 id="applications-title">Impacted applications</h2>
                  <span className="section-note">Link the components and source repositories</span>
                </div>
                <div className="multi-grid">
                  {multiReference('components')}
                  {multiReference('repositories')}
                </div>
              </section>
              <section className="description-section" aria-label="Release description">
                {text('short_description', 'Summarize the software component release')}
                {textarea(
                  'description',
                  'Enter a detailed description of the proposed change, including:\n• Background of the change and the request it originates from\n• Who requested or designed the change\n• Who should check the change\n• What will change and why',
                  5,
                )}
              </section>
              <section
                id="release-tabs"
                className="tab-section"
                aria-label="Release planning and assessment"
              >
                <div className="tabs" role="tablist" aria-label="Release sections">
                  {tabs.map((item) => {
                    const count = errorKeys.filter((key) => fieldTabs[key] === item.id).length;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        role="tab"
                        id={`tab-${item.id}`}
                        aria-controls={`panel-${item.id}`}
                        aria-selected={tab === item.id}
                        tabIndex={tab === item.id ? 0 : -1}
                        onClick={() => setTab(item.id)}
                        onKeyDown={(e) => {
                          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                            e.preventDefault();
                            const index = tabs.findIndex((t) => t.id === item.id);
                            const next =
                              e.key === 'Home'
                                ? 0
                                : e.key === 'End'
                                  ? tabs.length - 1
                                  : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                                    tabs.length;
                            setTab(tabs[next].id);
                            document.getElementById(`tab-${tabs[next].id}`)?.focus();
                          }
                        }}
                      >
                        {item.label}
                        {count > 0 && <span className="error-count">{count}</span>}
                        {item.id === 'activities' && activities.length > 0 && (
                          <span className="tab-count">{activities.length}</span>
                        )}
                      </button>
                    );
                  })}
                  <div className="tabs-right">
                    <ListFilter size={14} />
                    <span>Release information</span>
                  </div>
                </div>
                <div
                  id="panel-planning"
                  role="tabpanel"
                  aria-labelledby="tab-planning"
                  hidden={tab !== 'planning'}
                  className="tab-panel"
                >
                  <div className="planning-grid">
                    {text('release_version', 'e.g. 2.4.0')}
                    {select('environment', ['Production', 'Staging', 'UAT', 'Development'])}
                    {text('implementation_start', '', 'datetime-local')}
                    {text('implementation_end', '', 'datetime-local')}
                  </div>
                  {textarea(
                    'change_plan',
                    'Describe the implementation steps, deployment order, responsible teams, and verification checkpoints.',
                    4,
                  )}
                  {textarea(
                    'rollback_plan',
                    'Describe how to restore the previous version, rollback triggers, and recovery steps.',
                    3,
                  )}
                  {textarea(
                    'test_plan',
                    '1. Pre-implementation testing\nWhat testing was completed before deployment, and what were the results?\nProvide links to test evidence or explain if testing was not possible.\n\n2. Post-implementation testing\nHow will you validate the change after deployment?',
                    6,
                  )}
                </div>
                <div
                  id="panel-risk"
                  role="tabpanel"
                  aria-labelledby="tab-risk"
                  hidden={tab !== 'risk'}
                  className="tab-panel"
                >
                  <div className="planning-grid">
                    {select('risk_level', ['', 'Low', 'Medium', 'High'])}
                    {field(
                      'customer_impact',
                      <div
                        className="radio-group"
                        id="customer_impact"
                        data-field="customer_impact"
                        data-testid="customer_impact"
                        role="radiogroup"
                        aria-label="Customer impact"
                      >
                        {['No', 'Yes'].map((value) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name="customer_impact"
                              id={`customer_impact-${value.toLowerCase()}`}
                              value={value}
                              checked={form.customer_impact === value}
                              onChange={() => update('customer_impact', value)}
                            />
                            {value}
                          </label>
                        ))}
                      </div>,
                    )}
                  </div>
                  {textarea(
                    'risk_analysis',
                    'What are the key risks associated with this change?\nConsider outages, degraded performance, data or security impact, and user disruption.\nWhat is the impact on end users or the business once the change is implemented?\nWhat is the impact if the change needs to be rolled back?',
                    6,
                  )}
                  <div className="risk-options">
                    {checkbox('outage_required', 'This release requires a planned service outage')}
                    {form.outage_required && (
                      <div data-visible-when="outage_required=true">
                        {text(
                          'outage_minutes',
                          'Duration in minutes',
                          'number',
                          'Enter the expected downtime in whole minutes.',
                        )}
                      </div>
                    )}
                    {checkbox('security_review', 'This release needs a security review')}
                    {form.security_review && (
                      <div data-visible-when="security_review=true">
                        {text('security_reference', 'e.g. SEC-2026-0187')}
                      </div>
                    )}
                  </div>
                  {(form.customer_impact === 'Yes' || form.risk_level === 'High') && (
                    <div data-visible-when="customer_impact=Yes OR risk_level=High">
                      {textarea(
                        'communication_plan',
                        'Who needs to be notified, when will they be contacted, and how will service updates be shared?',
                        4,
                      )}
                    </div>
                  )}
                </div>
                <div
                  id="panel-activities"
                  role="tabpanel"
                  aria-labelledby="tab-activities"
                  hidden={tab !== 'activities'}
                  className="tab-panel"
                >
                  <div className="activity-heading">
                    <div>
                      <h3>Activity log</h3>
                      <p>Work notes and local release updates.</p>
                    </div>
                    <span className="tag">Internal notes</span>
                  </div>
                  <label className="work-note-label" htmlFor="work_notes">
                    Work notes
                  </label>
                  <textarea
                    id="work_notes"
                    name="work_notes"
                    data-field="work_notes"
                    data-input-kind="generated-text"
                    rows={3}
                    placeholder="Add an implementation update or a note for the release team..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="note-actions">
                    <span>Visible to the release team in this demo.</span>
                    <button
                      type="button"
                      className="button"
                      id="post-work-note"
                      disabled={!note.trim()}
                      onClick={() => {
                        addActivity(note.trim(), 'note');
                        setNote('');
                        setSaved(false);
                        setNotice('Work note added. Save the draft to keep it.');
                      }}
                    >
                      <Plus size={14} />
                      Post note
                    </button>
                  </div>
                  <div className="activity-list">
                    {activities.length === 0 ? (
                      <div className="no-activity">
                        <MessageSquare size={23} />
                        <div>
                          <strong>No activity yet</strong>
                          <p>Updates will appear here when you save or submit the release.</p>
                        </div>
                      </div>
                    ) : (
                      activities.map((item) => (
                        <article key={item.id} data-activity-id={item.id}>
                          <div className="activity-dot">
                            {item.kind === 'note' ? (
                              <MessageSquare size={14} />
                            ) : (
                              <Clock3 size={14} />
                            )}
                          </div>
                          <div className="activity-entry">
                            <div>
                              <strong>{item.kind === 'note' ? 'Spas Zahariev' : 'System'}</strong>
                              <time dateTime={item.time}>
                                {new Date(item.time).toLocaleString()}
                              </time>
                            </div>
                            <p>{item.text}</p>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </section>
              <section className="attachments" aria-labelledby="attachments-title">
                <div className="attachments-heading">
                  <h2 id="attachments-title">
                    <Paperclip size={16} />
                    Attachments <span className="count-badge">{attachments.length}</span>
                  </h2>
                  <button
                    type="button"
                    className="text-button"
                    id="add-attachment-bottom"
                    onClick={() => uploadRef.current?.click()}
                  >
                    <Plus size={14} />
                    Add attachment
                  </button>
                </div>
                <input
                  ref={uploadRef}
                  id="attachments"
                  name="attachments"
                  data-field="attachments"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    const allowed = files.filter((file) => file.size <= 20 * 1024 * 1024);
                    setAttachments((prev) => [
                      ...prev,
                      ...allowed.map((file) => ({
                        id: crypto.randomUUID(),
                        name: file.name,
                        size: file.size,
                        type: file.type,
                      })),
                    ]);
                    setSaved(false);
                    e.target.value = '';
                    setNotice(
                      files.length !== allowed.length
                        ? 'Files larger than 20 MB were skipped. Only file metadata is kept in this demo.'
                        : 'Attachment metadata added. File contents are not uploaded or stored.',
                    );
                  }}
                />
                {attachments.length === 0 ? (
                  <p>No attachments. Add test evidence, release notes, or supporting documents.</p>
                ) : (
                  <ul className="attachment-list">
                    {attachments.map((file) => (
                      <li key={file.id}>
                        <FileText size={16} />
                        <span>{file.name}</span>
                        <small>{(file.size / 1024).toFixed(1)} KB</small>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove attachment ${file.name}`}
                          onClick={() => {
                            setAttachments((prev) => prev.filter((a) => a.id !== file.id));
                            setSaved(false);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="bottom-actions">
                <div className="bottom-tools">
                  <button
                    type="button"
                    className="text-button"
                    id="export-json"
                    data-action="export-json"
                    onClick={exportJson}
                  >
                    <Download size={15} />
                    Export JSON
                  </button>
                  <span className="tool-divider" />
                  <button
                    type="button"
                    className="text-button muted"
                    id="reset-form"
                    onClick={() => setReset(true)}
                  >
                    Reset form
                  </button>
                </div>
                {actions('footer')}
              </div>
              <footer className="page-footer">
                <span>
                  <span className="local-dot" />
                  {saved ? 'Saved locally' : 'Local demo environment'}
                  <span className="footer-divider">/</span>No external services connected
                </span>
                <span>
                  Change Request<span className="footer-divider">/</span>
                  {form.number}
                </span>
              </footer>
            </div>
          </form>
        </main>
      </div>
      {lookup && (
        <LookupDialog
          lookup={lookup}
          value={form[lookup.field] as string | string[]}
          onSelect={choose}
          onClose={() => setLookup(null)}
        />
      )}
      {help && (
        <Dialog id="automation-help" title="About this release form" onClose={() => setHelp(false)}>
          <div className="help-content">
            <p>
              A React replica of the provided Change Request form. All records and workflow steps
              are local to this demo.
            </p>
            <h3>Ready for DOM-based automation</h3>
            <ul>
              <li>
                Every field has a stable <code>id</code>, <code>name</code>, and{' '}
                <code>data-field</code>.
              </li>
              <li>
                Lookup buttons have <code>data-action="open-lookup"</code>. Result rows expose{' '}
                <code>data-record-id</code>.
              </li>
              <li>
                Text areas have <code>data-input-kind="generated-text"</code> for text-generation
                models.
              </li>
              <li>
                Conditional fields expose <code>data-visible-when</code>. Tab panels use native{' '}
                <code>hidden</code> attributes.
              </li>
              <li>
                Save stores the draft in this browser. Export JSON downloads the current record.
                Attachments store metadata only.
              </li>
            </ul>
            <h3>Workflow</h3>
            <p>
              Submit, confirm, approve, mark implemented, and close the change. Editing a submitted
              record returns it to Draft. No approvals or deployments run outside this page.
            </p>
          </div>
          <div className="dialog-footer">
            <span>No animations. No model API calls.</span>
            <button type="button" className="button primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}
      {reset && (
        <Dialog id="reset-confirmation" title="Reset this release?" onClose={() => setReset(false)}>
          <div className="help-content">
            <p>
              This removes the saved draft, selected records, attachments, and activity notes from
              this browser. Export JSON first if you need a copy.
            </p>
          </div>
          <div className="dialog-footer">
            <span />
            <div className="button-group">
              <button type="button" className="button" onClick={() => setReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                id="confirm-reset"
                className="button danger"
                onClick={() => {
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {
                    setNotice(
                      'Could not remove the saved draft. Check browser storage permissions.',
                    );
                    setReset(false);
                    return;
                  }
                  setForm({ ...initialForm });
                  setStage(0);
                  setErrors({});
                  setAttachments([]);
                  setActivities([]);
                  setNote('');
                  setTab('planning');
                  setSaved(false);
                  setReferenceFilters({});
                  setReset(false);
                  setNotice('Form reset. Start a new release.');
                }}
              >
                Reset form
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
