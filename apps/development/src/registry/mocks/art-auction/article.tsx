"use client";

import { ArticleView } from "@elkdonis/cms-ui/article";
import "./auction-mock.css";

// Real component: cms-ui's ArticleView, with an invented post (the app's block passes it a forum topic).
export default function ArticleMock() {
  return (
    <ArticleView
      title="How a silent auction works"
      lede="A short guide to bidding, from the first look at a lot to the moment the hammer comes down."
      bodyHtml="<p>Every lot has a reserve and a closing time. You place a bid, and if someone bids higher you are told straight away.</p><h2>Before you bid</h2><p>Read the lot's notes, look at the <strong>condition</strong> photographs, and decide your limit first. Then bid once, calmly.</p><p>After the auction closes, the artist is paid and the piece is packed for pickup or shipping.</p>"
      authorName="A sample author"
      publishedAt="2026-10-20T12:00:00.000Z"
      coverImageUrl={null}
      reading="journal"
      kindLabel="Article"
      threadId="mock"
    />
  );
}
