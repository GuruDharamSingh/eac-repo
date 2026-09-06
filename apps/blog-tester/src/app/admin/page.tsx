import { BlogAdminPage } from "@elkdonis/blog-client";
import { blogConfig } from "../../config/blog";

export default function AdminPage() {
  return <BlogAdminPage config={blogConfig} />;
}
