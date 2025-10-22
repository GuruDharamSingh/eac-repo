import type { User } from './user';
import type { Meeting } from './meeting';
import type { Post } from './post';

export type ReplyParentType = 'meeting' | 'post' | 'reply';

export interface Reply {
  id: string;
  parentType: ReplyParentType;
  parentId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  meeting?: Meeting;
  post?: Post;
  parentReply?: Reply;
}
