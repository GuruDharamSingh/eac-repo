// Avatars and portraits are stored as paths relative to whichever app
// uploaded them ("/api/media/EAC_Network/users/…"). A host that serves no
// media route says where those resolve, once, and every image on the board
// goes through here.

let resolver: (url: string) => string = (u) => u;

export function configureForumMedia(fn: (url: string) => string): void {
  resolver = fn;
}

export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return resolver(url);
}
