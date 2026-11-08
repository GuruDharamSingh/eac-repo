export function useRouter() { return { refresh() {}, replace() {}, push() {} }; }
export function notFound(): never { throw new Error("notFound"); }
