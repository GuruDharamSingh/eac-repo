// The spec's icon set (README "Assets": Lucide at stroke-width 1.5), as a
// default HubIconMap. A host may pass its own map; cards ask by name only.

import {
  ArrowLeft, ArrowUpRight, Bookmark, Calendar, Camera, Check, ChevronDown, ChevronRight, Circle, CircleAlert,
  CircleCheck, Clock, Cloud, Copy, Ellipsis, Eye, EyeOff, File, Globe, Image, Info, LayoutGrid, Library, Link,
  List, Loader, Lock, Maximize2, Minus, PanelsTopLeft, Plus, Search, SquarePen, StickyNote, TriangleAlert,
  Upload, User, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import type { HubIconMap } from '../contract';

export const lucideHubIcons: HubIconMap = {
  // CommonIconName (@elkdonis/utils/host)
  back: ArrowLeft,
  close: X,
  plus: Plus,
  minus: Minus,
  caret: ChevronDown,
  check: Check,
  copy: Copy,
  external: ArrowUpRight,
  expand: Maximize2,
  more: Ellipsis,
  done: CircleCheck,
  empty: Circle,
  error: CircleAlert,
  warning: TriangleAlert,
  spinner: Loader,
  person: User,
  list: List,
  image: Image,
  upload: Upload,
  library: Library,
  camera: Camera,
  link: Link,
  public: Globe,
  members: Users,
  date: Calendar,
  clock: Clock,
  preview: Eye,
  previewOff: EyeOff,
  // the cards' own
  'panels-top-left': PanelsTopLeft,
  'square-pen': SquarePen,
  search: Search,
  'layout-grid': LayoutGrid,
  'chevron-right': ChevronRight,
  'sticky-note': StickyNote,
  bookmark: Bookmark,
  info: Info,
  file: File,
  users: Users,
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  lock: Lock,
  cloud: Cloud,
};
