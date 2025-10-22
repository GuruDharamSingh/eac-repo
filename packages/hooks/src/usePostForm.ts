import { useState } from 'react';

export interface PostFormData {
  title: string;
  body: string;
  excerpt: string;
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
}

export interface PostFormConfig {
  initialData?: Partial<PostFormData>;
}

export interface UsePostFormResult {
  formData: PostFormData;
  updateField: <K extends keyof PostFormData>(
    field: K,
    value: PostFormData[K]
  ) => void;
  resetForm: () => void;
  isValid: boolean;
}

const DEFAULT_FORM_DATA: PostFormData = {
  title: '',
  body: '',
  excerpt: '',
  visibility: 'PUBLIC',
};

export function usePostForm(config?: PostFormConfig): UsePostFormResult {
  const [formData, setFormData] = useState<PostFormData>({
    ...DEFAULT_FORM_DATA,
    ...config?.initialData,
  });

  const updateField = <K extends keyof PostFormData>(
    field: K,
    value: PostFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM_DATA, ...config?.initialData });
  };

  const isValid = formData.title.trim().length > 0 && formData.body.trim().length > 0;

  return {
    formData,
    updateField,
    resetForm,
    isValid,
  };
}
