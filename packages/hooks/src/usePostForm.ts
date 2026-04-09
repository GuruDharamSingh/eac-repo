import { useState } from 'react';

export interface PostFormData {
  title: string;
  body: string;
  excerpt: string;
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  media: File[];
  createTalkRoom: boolean;
  createDocument: boolean;
}

export interface PostFormConfig {
  initialData?: Partial<PostFormData>;
  visibleFields?: {
    title?: boolean;
    body?: boolean;
    excerpt?: boolean;
    visibility?: boolean;
    media?: boolean;
    createTalkRoom?: boolean;
    createDocument?: boolean;
  };
}

export interface UsePostFormResult {
  formData: PostFormData;
  updateField: <K extends keyof PostFormData>(
    field: K,
    value: PostFormData[K]
  ) => void;
  resetForm: () => void;
  isValid: boolean;
  config: PostFormConfig;
}

const DEFAULT_FORM_DATA: PostFormData = {
  title: '',
  body: '',
  excerpt: '',
  visibility: 'PUBLIC',
  media: [],
  createTalkRoom: false,
  createDocument: false,
};

const DEFAULT_VISIBLE_FIELDS = {
  title: true,
  body: true,
  excerpt: true,
  visibility: true,
  media: true,
  createTalkRoom: true,
  createDocument: true,
};

export function usePostForm(config?: PostFormConfig): UsePostFormResult {
  const mergedConfig = {
    ...config,
    visibleFields: { ...DEFAULT_VISIBLE_FIELDS, ...config?.visibleFields },
  };

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
    config: mergedConfig,
  };
}
