/**
 * Static hero image. Used to be a three-slide auto-rotating carousel; that
 * interactivity didn't earn its keep on a single-purpose landing hero, so
 * this keeps just the strongest of the three images and its copy.
 *
 * The image is a remote URL the previous version linked directly, kept as-is
 * so nothing visually disappears. Worth replacing with an uploaded media
 * asset eventually — it's hotlinked from a site outside our control and
 * will break if that site changes it.
 */
const HERO = {
  src: "https://toronto.citynews.ca/wp-content/blogs.dir/sites/10/2022/11/08/Centennial-Park-in-Etobicoke-1536x712.jpg",
  alt: "Toronto park landscape",
  title: "Amrit Vela - The Ambrosial Hours",
  subtitle: "Rise with the sun and crown yourself in sacred time",
};

export function HeroBanner() {
  return (
    <section className="relative h-[380px] overflow-hidden bg-[#36454f]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HERO.src} alt={HERO.alt} className="size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#36454f]/90 via-[#36454f]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-center">
        <h2
          className="font-serif text-[clamp(1.7rem,6vw,3rem)] leading-tight text-[#f4c430]"
          style={{ textShadow: "2px 2px 12px rgba(0,0,0,0.6)" }}
        >
          {HERO.title}
        </h2>
        <p
          className="mt-3 text-[clamp(0.95rem,3vw,1.25rem)] italic text-[#fdf5e6]"
          style={{ textShadow: "1px 1px 8px rgba(0,0,0,0.6)" }}
        >
          {HERO.subtitle}
        </p>
      </div>
    </section>
  );
}
