import type { KindMap } from "./shared";
import { reading } from "./reading";
import { watch } from "./watch";
import { reflection } from "./reflection";
import { practice } from "./practice";
import { photo } from "./photo";
import { recording } from "./recording";
import { conversation } from "./conversation";
import { gathering } from "./gathering";
import { resource } from "./resource";
import { quiz } from "./quiz";
import { setup } from "./setup";

export const KINDS: KindMap = { reading, watch, reflection, practice, photo, recording, conversation, gathering, resource, quiz, setup };
export const KIND_ORDER = ["reading", "watch", "reflection", "practice", "photo", "recording", "conversation", "gathering", "resource", "quiz", "setup"] as const;
export type { KindDef, DoProps, EditProps } from "./shared";
