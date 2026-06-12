import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  fetchInvestorForm,
  parseInvestorFormHtml,
  submitInvestorForm,
  type InvestorFormField,
  type ParsedInvestorForm,
} from '../../services/investorForm.service';
import type { InvestorFormResponse } from '../../store/mfJourneyStore';
import styles from './InvestorDetailsReactForm.module.scss';

interface InvestorDetailsReactFormProps {
  developerMode: boolean;
  formUrl: string;
  submissionId?: string;
  onFallback: (reason: string) => void;
  onSubmitted: (response: InvestorFormResponse) => void;
}

type FormValues = Record<string, string | string[] | boolean>;

const sectionOrder = [
  'Personal Details',
  'KYC Details',
  'Tax Residency',
  'Bank Details',
  'Nominee Details',
  'Additional Details',
];

const InvestorDetailsReactForm = ({
  developerMode,
  formUrl,
  onFallback,
  onSubmitted,
  submissionId,
}: InvestorDetailsReactFormProps) => {
  const [parsedForm, setParsedForm] = useState<ParsedInvestorForm | undefined>();
  const [values, setValues] = useState<FormValues>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        const html = await fetchInvestorForm(formUrl);
        const parsed = parseInvestorFormHtml(html, formUrl);
        if (cancelled) return;
        setParsedForm(parsed);
        setValues(defaultValues(parsed.fields));
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unable to parse investor form.';
        if (!cancelled) {
          setError(message);
          onFallback(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [formUrl, onFallback]);

  const groupedFields = useMemo(() => {
    const visibleFields = (parsedForm?.fields ?? []).filter((field) => field.type !== 'hidden');
    const grouped = new Map<string, InvestorFormField[]>();
    visibleFields.forEach((field) => {
      const section = field.section || 'Additional Details';
      grouped.set(section, [...(grouped.get(section) ?? []), field]);
    });

    return Array.from(grouped.entries()).sort(([left], [right]) => {
      const leftIndex = sectionOrder.indexOf(left);
      const rightIndex = sectionOrder.indexOf(right);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });
  }, [parsedForm]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parsedForm) return;

    const missingRequired = parsedForm.fields.filter((field) => field.required && !hasFormValue(values[field.name]));
    if (missingRequired.length) {
      setError(`Please complete required fields: ${missingRequired.map((field) => field.label).join(', ')}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(undefined);
      const response = await submitInvestorForm(parsedForm, values);
      const activeSubmissionId = response.submission_id ?? response.submissionId;
      if (response.success === true && activeSubmissionId) {
        onSubmitted({ ...response, success: true, submission_id: String(activeSubmissionId) });
        return;
      }
      throw new Error('Investor form response did not include submission_id.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit investor form.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className={styles.formShell}>Loading investor form...</p>;
  }

  if (!parsedForm) {
    return error ? <Alert severity="warning">{error}</Alert> : null;
  }

  return (
    <form className={styles.formShell} onSubmit={submit}>
      {submissionId ? (
        <div className={styles.successBox}>
          <div className={styles.successTitle}>
            <CheckCircleIcon fontSize="small" />
            <strong>Investor Form Submitted</strong>
          </div>
          <div>
            <span>Submission ID:</span>
            <strong>{submissionId}</strong>
          </div>
        </div>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {groupedFields.map(([section, fields]) => (
        <section className={styles.section} key={section}>
          <h5>{section}</h5>
          <div className={styles.grid}>{fields.map((field) => renderField(field, values, setValues))}</div>
        </section>
      ))}

      <div>
        <Button type="submit" variant="contained" disabled={isSubmitting || Boolean(submissionId)}>
          {isSubmitting ? 'Submitting...' : 'Submit Form'}
        </Button>
      </div>

      {developerMode ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Investor Form Debug</AccordionSummary>
          <AccordionDetails>
            <div className={styles.debugGrid}>
              <div>
                <span>Form Action URL</span>
                <strong>{parsedForm.action}</strong>
              </div>
              <div>
                <span>Submission ID</span>
                <strong>{submissionId || '-'}</strong>
              </div>
              <div>
                <span>Parsed Fields Count</span>
                <strong>{String(parsedForm.fields.length)}</strong>
              </div>
            </div>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </form>
  );
};

const renderField = (
  field: InvestorFormField,
  values: FormValues,
  setValues: (updater: (current: FormValues) => FormValues) => void,
) => {
  const value = values[field.name];

  if (field.type === 'radio') {
    return (
      <FormControl className={styles.choiceGroup} key={field.name} required={field.required}>
        <FormLabel>{field.label}</FormLabel>
        <RadioGroup
          name={field.name}
          onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
          value={typeof value === 'string' ? value : ''}
        >
          {(field.options ?? []).map((option) => (
            <FormControlLabel control={<Radio />} key={option.value} label={option.label} value={option.value} />
          ))}
        </RadioGroup>
      </FormControl>
    );
  }

  if (field.type === 'checkbox') {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <FormControl className={styles.choiceGroup} key={field.name} required={field.required}>
        <FormLabel>{field.label}</FormLabel>
        <FormGroup>
          {(field.options ?? [{ label: field.label, value: field.value || 'on' }]).map((option) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onChange={(event) => {
                    setValues((current) => {
                      const currentValues = Array.isArray(current[field.name]) ? (current[field.name] as string[]) : [];
                      return {
                        ...current,
                        [field.name]: event.target.checked
                          ? [...currentValues, option.value]
                          : currentValues.filter((entry) => entry !== option.value),
                      };
                    });
                  }}
                />
              }
              key={option.value}
              label={option.label}
            />
          ))}
        </FormGroup>
        {field.required ? <FormHelperText>Required</FormHelperText> : null}
      </FormControl>
    );
  }

  return (
    <TextField
      InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
      key={field.name}
      label={field.label}
      multiline={field.type === 'textarea'}
      name={field.name}
      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
      placeholder={field.placeholder}
      required={field.required}
      rows={field.type === 'textarea' ? 4 : undefined}
      select={field.type === 'select'}
      type={field.type === 'textarea' || field.type === 'select' ? 'text' : field.type}
      value={typeof value === 'string' ? value : ''}
    >
      {(field.options ?? []).map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

const defaultValues = (fields: InvestorFormField[]): FormValues =>
  fields.reduce<FormValues>((acc, field) => {
    if (field.type === 'checkbox') {
      acc[field.name] = [];
      return acc;
    }

    acc[field.name] = field.type === 'radio' ? '' : field.value ?? '';
    return acc;
  }, {});

const hasFormValue = (value: FormValues[string]): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return Boolean(String(value ?? '').trim());
};

export default InvestorDetailsReactForm;
