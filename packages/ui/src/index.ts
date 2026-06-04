// Shared Theme
export { eacTheme } from './theme';
export type { MantineColorsTuple } from './theme';

// Rich Text Editor
export { RichTextEditor } from './components/RichTextEditor';
export type { RichTextEditorProps } from './components/RichTextEditor';

// Rich Text renderer (sanitized HTML display)
export { RichText } from './components/RichText';
export type { RichTextProps } from './components/RichText';

// Blog Entry Components
export { BlogEntryForm } from './components/BlogEntryForm';
export type { BlogEntryFormData, BlogEntryFormProps } from './components/BlogEntryForm';

export { MediaUpload } from './components/MediaUpload';
export type { MediaUploadProps, SelectedNextcloudFile } from './components/MediaUpload';

export { MeetingForm } from './components/MeetingForm';
export type { MeetingFormProps, MeetingFormData, MeetingFormConfig } from './components/MeetingForm';

export { PostForm } from './components/PostForm';
export type { PostFormProps, PostFormData, PostFormConfig } from './components/PostForm';

// Unified content-creation form (progressive post → meeting → event → workshop)
export { ContentForm, inferKind } from './components/content-form';
export type {
  ContentDraft,
  ContentFormProps,
  ThreadKind,
  TierName,
  KindInferenceResult,
  ExtraField,
  WorkshopSessionDraft,
} from './components/content-form';

// Media Player Components
export { MediaPlayer, MediaGallery } from './components/media-player';
export type { MediaPlayerProps, MediaGalleryProps } from './components/media-player';

// Image Lightbox
export { ImageLightbox } from './components/image-lightbox';
export type { ImageLightboxProps } from './components/image-lightbox';

// Excalidraw Drawing Editor
export { ExcalidrawEditor } from './components/excalidraw-editor';
export type { ExcalidrawEditorProps } from './components/excalidraw-editor';

// Document Viewer Components
export { DocumentViewer, DocumentLink } from './components/document-viewer';
export type { DocumentViewerProps, DocumentLinkProps } from './components/document-viewer';

// Video Playlist
export { VideoPlaylist } from './components/video-playlist';
export type { VideoPlaylistProps, LiveVideo } from './components/video-playlist';

// RSVP Form (guest-friendly, no login required)
export { RsvpForm } from './components/RsvpForm';
export type { RsvpFormProps } from './components/RsvpForm';

// Workshop Components
export { DigitalFlyer, GuideBadge, ActionCard, StickyBottomBar } from './components/workshop-ui';

// Nextcloud Components
export { FileBrowser } from './nextcloud/file-browser';
export type { FileBrowserProps, NextcloudFile } from './nextcloud/file-browser';

export { TalkRoom } from './nextcloud/talk-room';
export type { TalkRoomProps, TalkMessage } from './nextcloud/talk-room';

export { NextcloudLink } from './nextcloud/nextcloud-link';
export type { NextcloudLinkProps } from './nextcloud/nextcloud-link';

// Universal auth UI (sign-in / sign-up form, authwall modal, RequireAuth gate)
export { AuthForm, AuthWall, RequireAuth } from './components/AuthForm';
export type {
  AuthFormProps,
  AuthWallProps,
  RequireAuthProps,
} from './components/AuthForm';

// Elkdonis Arts Collective shared landing / signup components (Mantine-free)
export { EacAtmosphere } from './components/EacAtmosphere';
export type { EacAtmosphereProps } from './components/EacAtmosphere';

export { BaroqueSignup } from './components/BaroqueSignup';
export type { BaroqueSignupProps } from './components/BaroqueSignup';

export { InquiryPrompt } from './components/InquiryPrompt';
export type { InquiryPromptProps } from './components/InquiryPrompt';

export { StickyJoinBar } from './components/StickyJoinBar';
export type { StickyJoinBarProps } from './components/StickyJoinBar';