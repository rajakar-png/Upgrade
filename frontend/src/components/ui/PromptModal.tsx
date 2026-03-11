'use client';

import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

interface PromptModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  type?: string;
}

export function PromptModal({
  open,
  onClose,
  onSubmit,
  title = 'Input',
  message,
  label,
  placeholder,
  defaultValue = '',
  submitLabel = 'Submit',
  type = 'text',
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  function handleSubmit() {
    if (!value.trim()) return;
    onSubmit(value);
  }

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-sm">
      {message && <p className="mb-3 text-sm text-gray-400">{message}</p>}
      <Input
        label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit}>{submitLabel}</Button>
      </div>
    </Modal>
  );
}
