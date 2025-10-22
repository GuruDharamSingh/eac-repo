export interface Topic {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  createdAt: Date;
  parent?: Topic;
  children?: Topic[];
}
