// next/navigation for the read-only probe (rendered outside Next): the Talk room only calls router.refresh() on a click.
const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const redirect = () => { throw new Error("redirect in probe"); };
export const notFound = () => { throw new Error("notFound in probe"); };
