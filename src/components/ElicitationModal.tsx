'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  MessageSquare,
  Server,
  ExternalLink,
  Check,
  AlertCircle,
} from 'lucide-react';
import type {
  ElicitationRequest,
  ElicitResult,
  PrimitiveSchemaDefinition,
  ElicitRequestFormParams,
  ElicitRequestURLParams,
  StringSchema,
  NumberSchema,
} from '@/lib/types';

interface ElicitationModalProps {
  request: ElicitationRequest;
  onSubmit: (result: ElicitResult) => void;
  onDecline: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

interface FormFieldProps {
  name: string;
  schema: PrimitiveSchemaDefinition;
  value: string | number | boolean | string[];
  onChange: (value: string | number | boolean | string[]) => void;
  required?: boolean;
}

function FormField({ name, schema, value, onChange, required }: FormFieldProps) {
  const title = schema.title || name;
  const description = schema.description;

  // String field (without enum/oneOf)
  if (schema.type === 'string' && !('enum' in schema) && !('oneOf' in schema)) {
    const stringSchema = schema as StringSchema;
    const format = stringSchema.format;
    const inputType = format === 'email' ? 'email' :
                      format === 'uri' ? 'url' :
                      format === 'date' ? 'date' :
                      format === 'date-time' ? 'datetime-local' : 'text';

    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          {title}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {description && (
          <p className="text-xs text-[var(--foreground-muted)]">{description}</p>
        )}
        <input
          type={inputType}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          minLength={stringSchema.minLength}
          maxLength={stringSchema.maxLength}
          required={required}
          className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
      </div>
    );
  }

  // Number/Integer field
  if (schema.type === 'number' || schema.type === 'integer') {
    const numberSchema = schema as NumberSchema;
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          {title}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {description && (
          <p className="text-xs text-[var(--foreground-muted)]">{description}</p>
        )}
        <input
          type="number"
          value={value as number}
          onChange={(e) => onChange(schema.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
          min={numberSchema.minimum}
          max={numberSchema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
          required={required}
          className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
      </div>
    );
  }

  // Boolean field
  if (schema.type === 'boolean') {
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <span className="text-sm font-medium">
            {title}
            {required && <span className="text-red-400 ml-1">*</span>}
          </span>
        </label>
        {description && (
          <p className="text-xs text-[var(--foreground-muted)] ml-6">{description}</p>
        )}
      </div>
    );
  }

  // Single-select enum (string with enum or oneOf)
  if (schema.type === 'string' && ('enum' in schema || 'oneOf' in schema)) {
    const options = 'oneOf' in schema && schema.oneOf
      ? schema.oneOf.map(opt => ({ value: opt.const, label: opt.title }))
      : (schema.enum || []).map(val => ({ value: val, label: val }));

    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          {title}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {description && (
          <p className="text-xs text-[var(--foreground-muted)]">{description}</p>
        )}
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-3 py-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        >
          <option value="">Select an option...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  // Multi-select enum (array type)
  if (schema.type === 'array') {
    const items = schema.items;
    const options = 'anyOf' in items && items.anyOf
      ? items.anyOf.map(opt => ({ value: opt.const, label: opt.title }))
      : (items.enum || []).map(val => ({ value: val, label: val }));

    const selectedValues = (value as string[]) || [];

    const toggleOption = (optValue: string) => {
      if (selectedValues.includes(optValue)) {
        onChange(selectedValues.filter(v => v !== optValue));
      } else {
        onChange([...selectedValues, optValue]);
      }
    };

    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          {title}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {description && (
          <p className="text-xs text-[var(--foreground-muted)]">{description}</p>
        )}
        <div className="space-y-2 p-2 bg-[var(--background-tertiary)] border border-[var(--border)] rounded-lg">
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.value)}
                onChange={() => toggleOption(opt.value)}
                className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400">
      Unsupported field type: {schema.type}
    </div>
  );
}

export function ElicitationModal({
  request,
  onSubmit,
  onDecline,
  onCancel,
  isProcessing = false,
}: ElicitationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | number | boolean | string[]>>({});

  const { params, serverName } = request;
  const isUrlMode = 'mode' in params && params.mode === 'url';

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Initialize form data with defaults for form mode
  useEffect(() => {
    if (!isUrlMode) {
      const formParams = params as ElicitRequestFormParams;
      const properties = formParams.requestedSchema?.properties || {};
      const initialData: Record<string, string | number | boolean | string[]> = {};

      for (const [key, schema] of Object.entries(properties)) {
        if (schema.default !== undefined) {
          initialData[key] = schema.default;
        } else if (schema.type === 'boolean') {
          initialData[key] = false;
        } else if (schema.type === 'array') {
          initialData[key] = [];
        } else if (schema.type === 'number' || schema.type === 'integer') {
          initialData[key] = 0;
        } else {
          initialData[key] = '';
        }
      }

      setFormData(initialData);
    }
  }, [params, isUrlMode]);

  const handleFieldChange = useCallback((name: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      action: 'accept',
      content: formData,
    });
  }, [formData, onSubmit]);

  const handleDecline = useCallback(() => {
    onSubmit({
      action: 'decline',
    });
    onDecline();
  }, [onSubmit, onDecline]);

  const handleCancel = useCallback(() => {
    onSubmit({
      action: 'cancel',
    });
    onCancel();
  }, [onSubmit, onCancel]);

  const handleOpenUrl = useCallback(() => {
    if (isUrlMode) {
      const urlParams = params as ElicitRequestURLParams;
      window.open(urlParams.url, '_blank', 'noopener,noreferrer');
    }
  }, [isUrlMode, params]);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !isProcessing && handleCancel()}
    >
      <div className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Input Requested</h3>
              <p className="text-xs text-[var(--foreground-muted)]">
                Server is requesting information
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="p-1 hover:bg-[var(--background-tertiary)] rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Server Info */}
          <div className="flex items-center gap-2 p-2.5 bg-[var(--background-tertiary)] rounded-lg">
            <Server className="w-4 h-4 text-[var(--foreground-muted)]" />
            <span className="text-sm font-medium">{serverName}</span>
          </div>

          {/* Message */}
          <div className="p-3 bg-[var(--background-tertiary)] rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{params.message}</p>
          </div>

          {/* URL Mode */}
          {isUrlMode && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--foreground-muted)]">
                Click the button below to open the authentication or input page in a new tab.
              </p>
              <button
                type="button"
                onClick={handleOpenUrl}
                className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </button>
            </div>
          )}

          {/* Form Mode */}
          {!isUrlMode && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {Object.entries((params as ElicitRequestFormParams).requestedSchema?.properties || {}).map(([name, schema]) => {
                const isRequired = (params as ElicitRequestFormParams).requestedSchema?.required?.includes(name);
                return (
                  <FormField
                    key={name}
                    name={name}
                    schema={schema}
                    value={formData[name]}
                    onChange={(value) => handleFieldChange(name, value)}
                    required={isRequired}
                  />
                );
              })}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex-1 px-3 py-2 bg-[var(--background-tertiary)] hover:bg-[var(--border)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={isProcessing}
            className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          {!isUrlMode && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isProcessing}
              className="flex-1 px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
