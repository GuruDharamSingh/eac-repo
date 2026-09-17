// ============================================================================
// Node bytes → web bytes.
//
// This package is server code and holds its payloads in `Buffer`, but the web
// APIs it hands them to (`fetch`, `Response`) take `BodyInit`, whose Node and
// DOM definitions disagree about whether a Buffer qualifies. The disagreement
// is only in the type system — a Buffer IS a Uint8Array at runtime and every
// implementation accepts one — but it surfaces as an error in any consumer
// whose tsconfig loads the DOM lib, which is every Next app here now that
// @elkdonis/services is consumed as source rather than as prebuilt .d.ts.
//
// So the conversion is explicit and zero-copy: a view over the same memory,
// not a copy of it. `new Uint8Array(buf)` would also type-check and would
// duplicate every image this process serves.
//
// The return type is `Uint8Array<ArrayBuffer>`, not the default
// `Uint8Array<ArrayBufferLike>`: since TypeScript 5.7 the array is generic in
// its backing store, and `BodyInit` accepts only a real ArrayBuffer — the
// `ArrayBufferLike` union also admits SharedArrayBuffer, which a body cannot
// be. Node's Buffer is never backed by a SharedArrayBuffer, so narrowing it
// here is sound, and it is asserted in ONE place rather than at each call.
// ============================================================================

/** A `BodyInit`-safe view over a Buffer's bytes. No copy. */
export function asBody(bytes: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    bytes.buffer as ArrayBuffer,
    bytes.byteOffset,
    bytes.byteLength
  );
}

/** The same, for a payload that may already be a Blob. */
export function asBodyOrBlob(payload: Buffer | Blob): Uint8Array<ArrayBuffer> | Blob {
  return payload instanceof Blob ? payload : asBody(payload);
}
