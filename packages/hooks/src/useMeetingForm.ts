import {
  useState,
  useMemo,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { MeetingVisibility } from '@elkdonis/types';
import { slugify, DEFAULT_MEETING_DURATION } from '@elkdonis/utils';

export interface MeetingFormData {
  title: string;
  slug: string;
  orgId: string;
  guideId: string;
  description: string;
  scheduledAt: Date | null;
  durationMinutes: number | string;
  location: string;
  isOnline: boolean;
  meetingUrl: string;
  visibility: MeetingVisibility;
  notes: string;
  media: File[];
  createDocument: boolean;
}

export interface MeetingFormConfig {
  requiredFields?: {
    title?: boolean;
    slug?: boolean;
    orgId?: boolean;
    guideId?: boolean;
    description?: boolean;
    scheduledAt?: boolean;
    location?: boolean;
  };
  visibleFields?: {
    title?: boolean;
    slug?: boolean;
    orgId?: boolean;
    guideId?: boolean;
    description?: boolean;
    scheduledAt?: boolean;
    durationMinutes?: boolean;
    location?: boolean;
    isOnline?: boolean;
    meetingUrl?: boolean;
    visibility?: boolean;
    notes?: boolean;
    media?: boolean;
    createDocument?: boolean;
  };
  organizationOptions?: Array<{ value: string; label: string }>;
  fixedValues?: Partial<MeetingFormData>;
}

export interface UseMeetingFormResult {
  formData: MeetingFormData;
  isSubmitting: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  isFormValid: boolean;
  handleChange: <K extends keyof MeetingFormData>(field: K, value: MeetingFormData[K]) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  mergedConfig: {
    requiredFields: MeetingFormConfig['requiredFields'];
    visibleFields: MeetingFormConfig['visibleFields'];
    organizationOptions: NonNullable<MeetingFormConfig['organizationOptions']>;
    fixedValues: NonNullable<MeetingFormConfig['fixedValues']>;
  };
}

export interface UseMeetingFormResult {
  formData: MeetingFormData;
  isSubmitting: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  isFormValid: boolean;
  handleChange: <K extends keyof MeetingFormData>(field: K, value: MeetingFormData[K]) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  mergedConfig: {
    requiredFields: MeetingFormConfig['requiredFields'];
    visibleFields: MeetingFormConfig['visibleFields'];
    organizationOptions: NonNullable<MeetingFormConfig['organizationOptions']>;
    fixedValues: NonNullable<MeetingFormConfig['fixedValues']>;
  };
}

const DEFAULT_CONFIG: MeetingFormConfig = {
  requiredFields: {
    title: true,
    scheduledAt: true,
  },
  visibleFields: {
    title: true,
    slug: true,
    orgId: true,
    guideId: true,
    description: true,
    scheduledAt: true,
    durationMinutes: true,
    location: true,
    isOnline: true,
    meetingUrl: true,
    visibility: true,
    notes: true,
    media: true,
    createDocument: true,
  },
};

export function useMeetingForm(config: MeetingFormConfig = {}): UseMeetingFormResult {
  // Merge with default config
  const mergedConfig = useMemo(() => ({
    requiredFields: { ...DEFAULT_CONFIG.requiredFields, ...config.requiredFields },
    visibleFields: { ...DEFAULT_CONFIG.visibleFields, ...config.visibleFields },
    organizationOptions: config.organizationOptions || [],
    fixedValues: config.fixedValues || {},
  }), [config]);

  const [formData, setFormData] = useState<MeetingFormData>({
    title: "",
    slug: "",
    orgId: mergedConfig.organizationOptions?.[0]?.value ?? "",
    guideId: "",
    description: "",
    scheduledAt: null,
    durationMinutes: DEFAULT_MEETING_DURATION,
    location: "",
    isOnline: false,
    meetingUrl: "",
    visibility: "PUBLIC",
    notes: "",
    media: [],
    createDocument: false,
    ...mergedConfig.fixedValues,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = useMemo(() => {
    const checks: boolean[] = [];

    if (mergedConfig.requiredFields?.title) {
      checks.push(Boolean(formData.title.trim()));
    }
    if (mergedConfig.requiredFields?.slug) {
      checks.push(Boolean(formData.slug.trim()));
    }
    if (mergedConfig.requiredFields?.orgId) {
      checks.push(Boolean(formData.orgId));
    }
    if (mergedConfig.requiredFields?.guideId) {
      checks.push(Boolean(formData.guideId.trim()));
    }
    if (mergedConfig.requiredFields?.location) {
      checks.push(Boolean(formData.location.trim()));
    }
    if (mergedConfig.requiredFields?.scheduledAt) {
      checks.push(Boolean(formData.scheduledAt));
    }

    return checks.every(Boolean);
  }, [formData, mergedConfig.requiredFields]);

  const handleChange = useCallback(<K extends keyof MeetingFormData>(
    field: K,
    value: MeetingFormData[K]
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-generate slug from title if slug is visible
      if (field === "title" && typeof value === "string" && mergedConfig.visibleFields?.slug) {
        next.slug = slugify(value);
      }

      return next;
    });
  }, [mergedConfig.visibleFields]);

  const validateForm = useCallback(() => {
    if (!isFormValid) {
      setError("Please fill in all required fields");
      return false;
    }

    if (formData.isOnline && !formData.meetingUrl.trim()) {
      setError("Meeting URL is required for online meetings");
      return false;
    }

    return true;
  }, [isFormValid, formData]);

  const resetForm = useCallback(() => {
    setFormData({
      title: "",
      slug: "",
      orgId: mergedConfig.organizationOptions?.[0]?.value ?? "",
      guideId: "",
      description: "",
      scheduledAt: null,
      durationMinutes: DEFAULT_MEETING_DURATION,
      location: "",
      isOnline: false,
      meetingUrl: "",
      visibility: "PUBLIC",
      notes: "",
      media: [],
      createDocument: false,
      ...mergedConfig.fixedValues,
    });
    setError(null);
  }, [mergedConfig]);

  return {
    formData,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    isFormValid,
    handleChange,
    validateForm,
    resetForm,
    mergedConfig,
  };
}
