"use client";

import styles from "./blog-card.module.scss";

export interface BlogCardPost {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  author: string | null;
  excerpt: string;
  imageUrl: string | null;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BlogCard({ post, alt }: { post: BlogCardPost; alt?: boolean }) {
  return (
    <div className={`${styles.blogCard} ${alt ? styles.alt : ""}`}>
      <div className={styles.meta}>
        <div
          className={styles.photo}
          style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})` } : undefined}
        />
        {!post.imageUrl && <div className={styles.noImage} aria-hidden>IFAC</div>}
        <ul className={styles.details}>
          {post.author && (
            <li>
              <span className={styles.detailLabel}>Author</span>{" "}
              {post.author}
            </li>
          )}
          {post.publishedAt && (
            <li>
              <span className={styles.detailLabel}>Date</span>{" "}
              {formatDate(post.publishedAt)}
            </li>
          )}
        </ul>
      </div>
      <div className={styles.description}>
        <h3>
          <a href={post.url} target="_blank" rel="noreferrer">{post.title}</a>
        </h3>
        {post.author && <p className={styles.subtitle}>{post.author}</p>}
        {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
        <p className={styles.readMore}>
          <a href={post.url} target="_blank" rel="noreferrer">Read More</a>
        </p>
      </div>
    </div>
  );
}

export function BlogCardGrid({ posts }: { posts: BlogCardPost[] }) {
  return (
    <div>
      {posts.map((post, i) => (
        <BlogCard key={post.id} post={post} alt={i % 2 !== 0} />
      ))}
    </div>
  );
}
