import { UNIVERSAL_PHARMACY } from "@/lib/content";

export const metadata = { title: "Universal Pharmacy" };

export default function UniversalPharmacyPage() {
  return (
    <article className="content-page content-page--wide">
      <h1 className="page-title">Universal Pharmacy</h1>
      <div className="manifesto-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={UNIVERSAL_PHARMACY.image} alt="" className="circle-crop" />
        <div>
          <p style={{ fontStyle: "italic" }}>{UNIVERSAL_PHARMACY.caption}</p>
          {UNIVERSAL_PHARMACY.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
