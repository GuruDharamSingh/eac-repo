import { createMediaUploadHandler } from '@elkdonis/blog-server';
import { blogConfig } from '../../../../config/blog';

export const POST = createMediaUploadHandler(blogConfig);
