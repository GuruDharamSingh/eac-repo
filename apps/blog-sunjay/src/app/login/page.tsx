import { BlogLoginForm } from '@elkdonis/blog-client';
import { blogConfig } from '../../config/blog';

export const metadata = {
  title: 'Author Sign In',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <BlogLoginForm redirectPath={blogConfig.entryRedirectPath || '/entry'} />
    </div>
  );
}
