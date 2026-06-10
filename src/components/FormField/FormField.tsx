import { TextField, MenuItem, type TextFieldProps } from '@mui/material';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

export interface FieldOption {
  label: string;
  value: string;
}

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  type?: TextFieldProps['type'];
  options?: FieldOption[];
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  inputProps?: TextFieldProps['inputProps'];
}

const FormField = <T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  options,
  multiline,
  rows,
  disabled,
  required,
  helperText,
  inputProps,
}: FormFieldProps<T>) => (
  <Controller
    control={control}
    name={name}
    rules={required ? { required: `${label} is required` } : undefined}
    render={({ field, fieldState }) => (
      <TextField
        {...field}
        label={label}
        type={type}
        select={Boolean(options)}
        multiline={multiline}
        rows={rows}
        disabled={disabled}
        error={Boolean(fieldState.error)}
        helperText={fieldState.error?.message ?? helperText}
        inputProps={inputProps}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        onChange={(event) => {
          const nextValue = type === 'number' ? Number(event.target.value) : event.target.value;
          field.onChange(nextValue);
        }}
      >
        {options?.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    )}
  />
);

export default FormField;
