import Icon from "@/components/ui/AppIcon";
import AppImage from "@/components/ui/AppImage";
import { Link } from "@/i18n/navigation";
import { mediaUrl, type PageBlock } from "@/lib/api/public";
import RichText from "@/components/RichText";

/**
 * Renders a page's editable blocks.
 *
 * Every section page is built from these, so adding copy to /o-nama or
 * /kontakt is editing rows at /admin/pages rather than changing code. Blocks
 * alternate sides when they carry an image, which gives a page of several
 * blocks some rhythm without needing a layout field to configure.
 *
 * A block with nothing in it renders nothing. An empty section is the honest
 * signal that the content has not been written yet.
 */
export default function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  const visible = blocks.filter(
    (block) => block.heading || block.body || block.subheading || mediaUrl(block.image),
  );

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((block, index) => (
        <Block key={block.id} block={block} reverse={index % 2 === 1} />
      ))}
    </>
  );
}

function Block({ block, reverse }: { block: PageBlock; reverse: boolean }) {
  const image = mediaUrl(block.image);

  return (
    <section className="py-16 px-6 border-b border-ts-border last:border-b-0">
      {/* Both shapes sit in the same 7xl column as the hero above and every
          other section of the page. A text-only block used to narrow to 3xl
          for readability, which is sound typography in isolation and wrong
          here: it made an added block render at roughly half the width of
          everything around it, reading as a layout fault rather than a
          choice. Matching the page wins. */}
      <div
        className={
          image
            ? "max-w-7xl mx-auto grid gap-12 items-center lg:grid-cols-2"
            : "max-w-7xl mx-auto"
        }>
        <div className={`space-y-5 ${image && reverse ? "lg:order-2" : ""}`}>
          {block.eyebrow && (
            <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
              <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
                {block.eyebrow}
              </span>
            </div>
          )}

          {block.heading && (
            <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold text-ts-fg leading-tight">
              {block.heading}
            </h2>
          )}

          {block.subheading && (
            <p className="text-lg text-ts-fg/80 font-light">{block.subheading}</p>
          )}

          {block.body && (
            <RichText html={block.body} />
          )}

          {block.ctaLabel && block.ctaHref && (
            <Link
              href={block.ctaHref}
              className="inline-flex items-center gap-2 text-sm font-bold text-ts-fg border-b border-ts-red pb-1 hover:gap-3 transition-all">
              {block.ctaLabel}
              <Icon name="ArrowRightIcon" size={14} className="text-ts-red" />
            </Link>
          )}
        </div>

        {image && (
          <div className={`relative h-[clamp(14rem,32vw,24rem)] rounded-[28px] overflow-hidden ${reverse ? "lg:order-1" : ""}`}>
            <AppImage
              src={image}
              alt={block.image?.alt ?? block.heading ?? ""}
              fill
              className="object-cover w-full h-full" />
          </div>
        )}
      </div>
    </section>
  );
}
