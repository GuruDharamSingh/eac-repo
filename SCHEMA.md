# Chunker output: chunk and tag tables

Postgres 18 + pgvector 0.8.1 inside WSL (distro `Ubuntu`), database `chunker`, `localhost:5432`,
role `justin` (password in `~/.pgpass`). WSL forwards localhost, so the Windows host can reach
it at `localhost:5432` too. DevServer can't reach it as-is.

Tagger: astro-tagger `2026-09-27+878b6a4dab`, from `~/chunker/astro-tagger/`.

## How the tables join

    chunker_documents.content_hash  =  data_chunks.metadata_->>'doc_hash'  =  chunker_factor_tags.doc_hash
    data_chunks.node_id             =  chunker_factor_tags.chunk_id

Only import books with `chunker_documents.status = 'tagged'`. Other statuses are mid-pipeline
or waiting for review (`needs_review`).

## chunker_documents: one row per book (identified by content hash)

| column | type | notes |
|---|---|---|
| content_hash | text PK | sha256 of the file; stable across renames and moves |
| title | text | cleaned from the file name; can be corrected with `chunker meta` |
| author | text, nullable | from PDF metadata or set by hand; see `meta_source` |
| zodiac | text | `tropical` or `sidereal` (Vedic books, signs about 24° off tropical) |
| meta_source | text | `guess` (automatic) or `manual` (checked by a person) |
| file_type | text | `pdf`, `docx`, `html`, ... |
| n_pages, n_chunks | int | |
| status | text | `new` → `converted` → `chunked` → `embedded` → `tagged`; also `needs_review` |
| tagger_version | text | tagger that produced this book's tags |
| quality | jsonb | extraction check: word_ratio, empty_page_ratio, ocr_mode, ... |

File paths are in `chunker_files(path, content_hash)`, relative to the source folder `~/ChunkerMouth`.
One book can have several paths when the same file is stored twice.

## data_chunks: one row per chunk (LlamaIndex PGVectorStore table)

| column | type | notes |
|---|---|---|
| node_id | varchar | chunk id, UUIDv5 of (doc_hash, chunk_index) |
| text | varchar | `title \n heading 1 \n ... \n body`, the exact text that was embedded |
| embedding | halfvec(2560) | `qwen3-embedding:4b` via Ollama, cosine (HNSW `halfvec_cosine_ops`) |
| metadata_ | jsonb | keys below |
| text_search_tsv | tsvector | generated, English, for keyword search |

`metadata_` keys to use:

| key | example | notes |
|---|---|---|
| doc_hash | `18713624…` | → chunker_documents |
| chunk_index | `123` | order within the book |
| title, author, zodiac | | copied from chunker_documents at tag time |
| source | `Encyclopedia of Astrology (Nicholas deVore).pdf` | relative path |
| headings | `["The Heroic Round", "SATURN IN THE ELEMENTS", "Saturn in Fire Signs"]` | outermost first |
| pages | `[76, 77]` | **physical PDF pages, 1-based**, not the printed page numbers |
| n_tokens | `514` | Qwen3 tokenizer, includes title and headings |
| factor_keys | `["sign:sun:capricorn", ...]` | strongest first; full detail in chunker_factor_tags |
| tagger_version | | |
| norm_hash | | normalized-text hash used for de-duplication |

Ignore `_node_content`, `_node_type`, `doc_id`, `ref_doc_id` and `document_id`. They're LlamaIndex internals.

**Body without title and headings:** drop the first `1 + len(headings)` lines of `text`. The same
body is stored as `body` in `~/chunker-data/chunks/<doc_hash>.jsonl`, which is what the tagger was given.

Chunk ids are stable while chunk settings stay the same. A re-chunk can change them, so import a
book as a whole: replace all its chunks and tags by `doc_hash`.

Chunks whose text already appears in another book (near-duplicate editions) are stored only once,
under the first book embedded.

## chunker_factor_tags: one row per (chunk, factor)

| column | type | notes |
|---|---|---|
| chunk_id | text | → data_chunks.node_id |
| doc_hash | text | → chunker_documents (ON DELETE CASCADE) |
| factor_key | text | registry key, e.g. `aspect:sun:saturn:square` |
| confidence | text | `explicit`, `heading`, `inferred`, `mentioned` |
| kind | text | registry kind (`sign`, `house`, `aspect`, `transit`, `planet`, ...) |
| point, other_point | text | tagger's `point`, `other` |
| sign, other_sign | text | |
| house | smallint | 1–12 |
| aspect | text | |
| match | text | text that matched, or `heading: <heading>` |
| zodiac | text | the book's zodiac, so sidereal rows can be excluded without a join |
| tagger_version | text | re-tag when this changes |

PK `(chunk_id, factor_key)`. Indexed: `factor_key`, `(point, kind)`, `sign`, `house`, `aspect`, `doc_hash`.

Example: every chunk about the Sun in any aspect, tropical books, then ranked by similarity:

    SELECT c.node_id, c.text, c.metadata_->'pages' AS pages
    FROM data_chunks c
    WHERE c.node_id IN (
        SELECT chunk_id FROM chunker_factor_tags
        WHERE point = 'sun' AND kind = 'aspect' AND zodiac = 'tropical'
          AND confidence IN ('explicit', 'heading')
    )
    ORDER BY c.embedding <=> $1::halfvec
    LIMIT 10;

The database sets `hnsw.iterative_scan = relaxed_order`, so filtered vector queries still return
a full `LIMIT`.

Query embeddings need Qwen3's instruction prefix; documents were embedded without one:

    Instruct: Given a question, retrieve passages that answer the question
    Query: <question>

## Files on disk (`~/chunker-data/`)

- `chunks/<doc_hash>.jsonl`: id, doc_hash, chunk_index, title, source, headings, pages, n_tokens, norm_hash, text, body
- `tags/<doc_hash>.jsonl`: the tagger's raw output per chunk (id, factor_keys, factor_tags, tagger_version)
- `markdown/<doc_hash>.md`, `docling/<doc_hash>.json`: the converted book
