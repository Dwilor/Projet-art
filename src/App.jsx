import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { biography, money, works } from "./content";
import { Admin } from "./Admin";
import { RoomView } from "./RoomView";
const Site = createContext(null);
export function Icon({ name = "arrow", ...props }) {
  const paths = {
    arrow: (
      <>
        <path d="M4 12h16M14 6l6 6-6 6" />
      </>
    ),
    bag: (
      <>
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
    menu: <path d="M3 7h18M3 16h18" />,
    plus: <path d="M12 4v16M4 12h16" />,
    minus: <path d="M4 12h16" />,
    chevron: <path d="m8 5 7 7-7 7" />,
    zoom: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5M7 10h6M10 7v6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
function Symbol({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 140"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M78 0 C4 0 0 57 49 73 C79 83 77 113 32 122 L32 140 C107 132 118 72 63 56 C25 45 37 16 78 16 Z" />
      <path d="M4 79 H14 V140 H4 Z M87 0 H97 V61 H87 Z" />
    </svg>
  );
}
function Link({ href, children, className = "", ...props }) {
  return (
    <a href={href} className={className} data-nav {...props}>
      {children}
    </a>
  );
}
function TextLink({ href, children, light = false }) {
  return (
    <Link href={href} className={`text-link ${light ? "light" : ""}`}>
      {children}
      <Icon />
    </Link>
  );
}
function ButtonLink({ href, children, secondary = false }) {
  return (
    <Link href={href} className={`button ${secondary ? "secondary" : ""}`}>
      {children}
      <Icon />
    </Link>
  );
}
export function ArtImage({
  work,
  priority = false,
  sizes = "(max-width: 700px) 90vw, 40vw",
  className = "",
  detail = false,
}) {
  const base = work.image.startsWith("media-") ? "/media" : "/images";
  return (
    <picture className={`art-image ${className}`}>
      <source
        type="image/webp"
        srcSet={[480, 800, 1122]
          .map((w) => `${base}/${work.image}-${w}.webp ${w}w`)
          .join(", ")}
        sizes={sizes}
      />
      <img
        src={`${base}/${work.image}.png`}
        alt={detail ? `Détail de matière — ${work.alt}` : work.alt}
        width={work.pixelsWidth || 1122}
        height={work.pixelsHeight || 1402}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}
function Header() {
  const { url, cart } = useContext(Site);
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const panel = useRef(null);
  const nav = [
    ["/originaux", "Originaux"],
    ["/reproductions", "Reproductions"],
    ["/chez-moi", "Chez vous"],
    ["/a-propos", "À propos"],
    ["/contact", "Contact"],
  ];
  useEffect(() => setOpen(false), [url]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("a")?.focus();
    function key(e) {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current.focus();
      }
      if (e.key === "Tab") {
        const focus = [...panel.current.querySelectorAll("a,button")];
        const first = focus[0],
          last = focus.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Sirius, accueil">
          <Symbol />
          <span>Sirius</span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigation principale">
          {nav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                url.split("?")[0].startsWith(href) ? "page" : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            href="/panier"
            className="cart-link"
            aria-label={`Panier, ${cart.reduce((s, l) => s + l.quantity, 0)} article(s)`}
          >
            <Icon name="bag" />
            <span className="cart-word">Panier</span>
            <span className="cart-count">
              ({cart.reduce((s, l) => s + l.quantity, 0)})
            </span>
          </Link>
          <button
            className="menu-toggle icon-button"
            ref={toggle}
            onClick={() => setOpen(!open)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <div
          className="mobile-menu"
          id="mobile-menu"
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            className="mobile-close icon-button"
            onClick={() => {
              setOpen(false);
              toggle.current.focus();
            }}
            aria-label="Fermer le menu"
          >
            <Icon name="close" />
          </button>
          <p className="eyebrow">L’univers Sirius</p>
          <nav aria-label="Navigation mobile">
            {nav.map(([href, label], i) => (
              <Link href={href} key={href}>
                <span className="nav-number">0{i + 1}</span>
                {label}
                <Icon />
              </Link>
            ))}
          </nav>
          <p className="menu-footer">
            Peintures abstraites.
            <br />
            Matière, formes et équilibre.
          </p>
        </div>
      )}
    </header>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link
          href="/"
          className="brand footer-brand"
          aria-label="Sirius, accueil"
        >
          <Symbol />
          <span>Sirius</span>
        </Link>
        <p>
          Un dialogue entre les formes,
          <br />
          les couleurs et la matière.
        </p>
        <TextLink href="/contact">Restons en lien</TextLink>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Sirius</span>
        <nav aria-label="Informations">
          <Link href="/livraison-retours">Livraison et retours</Link>
          <Link href="/cgv">CGV</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </nav>
        <span className="footer-note">Peintures & reproductions</span>
      </div>
    </footer>
  );
}
function WorkCard({ work, product, type = "original", className = "" }) {
  const path = type === "print" ? "/reproductions" : "/originaux";
  return (
    <article className={`work-card ${className}`}>
      <Link
        className="work-image-link"
        href={`${path}/${product?.slug || work.id}`}
        aria-label={`Découvrir ${product?.title || work.reference}`}
      >
        <ArtImage work={work} />
        <span className="work-hover">
          <Icon name="plus" />
        </span>
      </Link>
      <div className="work-caption">
        <div>
          <Link href={`${path}/${product?.slug || work.id}`}>
            {product?.title || work.reference}
          </Link>
          <p>
            {product?.width && product?.height
              ? `${product.width} × ${product.height} cm`
              : type === "print"
                ? "Composition pour reproduction"
                : "Peinture abstraite"}
          </p>
        </div>
        <span>
          {product?.status === "available" && product.price ? (
            money(product.price)
          ) : product?.status === "sold" ? (
            "Vendue"
          ) : (
            <Icon name="arrow" />
          )}
        </span>
      </div>
    </article>
  );
}
function Home() {
  const { data } = useContext(Site);
  const product = (w) =>
    data.products.find((p) => p.image === w.image && p.type === "original");
  const featured = data.products
    .filter((p) => p.type === "original" && p.featured)
    .slice(0, 3);
  const selection = featured.length
    ? featured
        .map((p) =>
          [...works, ...(data.media || [])].find((w) => w.image === p.image),
        )
        .filter(Boolean)
    : data.mode === "preview"
      ? [works[1], works[3], works[2]]
      : data.products
          .filter((p) => p.type === "original")
          .slice(0, 3)
          .map((p) =>
            [...works, ...(data.media || [])].find((w) => w.image === p.image),
          )
          .filter(Boolean);
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="little-line" />
            Peintures abstraites · Sirius
          </p>
          <h1>
            La matière,
            <br />
            en <em>équilibre.</em>
          </h1>
          <p className="hero-description">
            Peintures abstraites et reproductions
            <br className="desktop-only" /> par Sirius.
          </p>
          <div className="hero-links">
            <ButtonLink href="/originaux">Découvrir les originaux</ButtonLink>
            <TextLink href="/reproductions">Voir les reproductions</TextLink>
          </div>
          <div className="hero-footnote">
            <span>
              Formes libres.
              <br />
              Traces sensibles.
            </span>
            <span className="hero-scroll">
              Explorer l’univers
              <Icon className="down-arrow" />
            </span>
          </div>
        </div>
        <div className="hero-art">
          <Link
            href={
              product(works[0])
                ? `/originaux/${product(works[0]).slug}`
                : data.mode === "preview"
                  ? "/originaux/art-001"
                  : "/originaux"
            }
            className="hero-frame"
            aria-label="Découvrir la composition ART-001"
          >
            <ArtImage
              work={works[0]}
              priority
              sizes="(max-width: 700px) 85vw, 42vw"
            />
          </Link>
          <div className="hero-art-caption">
            <span>Un dialogue de formes et de matières</span>
            <span>
              01 <span className="muted">/ 05</span>
            </span>
          </div>
          <span className="vertical-label">Dans l’atelier de Sirius</span>
        </div>
      </section>
      <section
        className="originals-section page-width"
        aria-labelledby="selection-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 — Les originaux</p>
            <h2 id="selection-title">
              Des formes.
              <br />
              <em>Une présence.</em>
            </h2>
          </div>
          <div className="section-heading-side">
            <p>
              Chaque peinture possède ses propres traces
              <br className="desktop-only" /> et ses variations de matière.
            </p>
            <TextLink href="/originaux">Voir tous les originaux</TextLink>
          </div>
        </div>
        <div className="selected-grid">
          {selection.map((w, i) => (
            <WorkCard
              key={w.id}
              work={w}
              product={product(w)}
              className={`selected-${i + 1}`}
            />
          ))}
        </div>
      </section>
      <section className="matter-section">
        <div className="matter-image">
          <ArtImage
            work={works[4]}
            detail
            sizes="(max-width: 700px) 100vw, 52vw"
          />
          <span className="detail-caption">Détail de matière · ART-005</span>
        </div>
        <div className="matter-copy">
          <p className="eyebrow">02 — Le geste</p>
          <h2>
            Les traces
            <br />
            <em>du geste.</em>
          </h2>
          <p>
            Je travaille par couches et je laisse certaines traces visibles.
            Elles participent à l’équilibre du tableau.
          </p>
          <TextLink href="/a-propos" light>
            Découvrir ma démarche
          </TextLink>
          <Symbol className="matter-symbol" />
        </div>
      </section>
      <section className="prints-section page-width">
        <div className="prints-copy">
          <p className="eyebrow">03 — Les reproductions</p>
          <h2>
            Une autre façon
            <br />
            de découvrir
            <br />
            <em>mon univers.</em>
          </h2>
          <p>
            Certaines compositions sont proposées en reproduction. Vous
            trouverez les formats et les caractéristiques d’impression sur
            chaque fiche.
          </p>
          <TextLink href="/reproductions">Découvrir les reproductions</TextLink>
        </div>
        <div className="prints-image">
          <Link href="/reproductions" aria-label="Découvrir les reproductions">
            <div className="print-mat">
              <ArtImage work={works[1]} />
            </div>
          </Link>
          <span className="eyebrow">Les compositions, autrement.</span>
        </div>
      </section>
      <section className="biography-band page-width">
        <span className="eyebrow">Derrière les toiles</span>
        <p>
          « J’aime explorer l’équilibre entre les formes,
          <br className="desktop-only" /> les couleurs et les espaces. »
        </p>
        <TextLink href="/a-propos">Découvrir ma démarche</TextLink>
      </section>
      <ContactInvitation />
    </>
  );
}
function ContactInvitation() {
  return (
    <section className="contact-invitation">
      <div className="page-width">
        <p className="eyebrow">Un échange, simplement</p>
        <h2>
          Une œuvre vous <em>parle ?</em>
        </h2>
        <p>Vous avez une question sur une œuvre ou son format ?</p>
        <ButtonLink href="/contact" secondary>
          Me contacter
        </ButtonLink>
      </div>
    </section>
  );
}
function Catalog({ type }) {
  const { data } = useContext(Site);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("selection");
  const prints = type === "print";
  const real = data.products.filter((p) => p.type === type);
  let items = real
    .map((p) => ({
      work: [...works, ...(data.media || [])].find((w) => w.image === p.image),
      product: p,
    }))
    .filter((x) => x.work);
  if (data.mode === "preview" && !items.length)
    items = (prints ? [works[1], works[4]] : works).map((work) => ({ work }));
  if (filter === "available")
    items = items.filter((i) => i.product?.status === "available");
  if (sort !== "selection")
    items.sort(
      (a, b) =>
        (sort === "asc" ? 1 : -1) *
        ((a.product?.price ?? Infinity) - (b.product?.price ?? Infinity)),
    );
  return (
    <>
      <section className="catalog-intro page-width">
        <p className="eyebrow">
          L’univers Sirius · {prints ? "Les reproductions" : "Les originaux"}
        </p>
        <div className="catalog-title-row">
          <h1>
            {prints ? (
              "Reproductions."
            ) : (
              <>
                Œuvres
                <br />
                <em>originales.</em>
              </>
            )}
          </h1>
          <p>
            {prints
              ? "Les compositions trouvent une autre présence. Découvrez les visuels sélectionnés pour les futures reproductions."
              : "Chaque peinture possède ses propres traces et ses variations de matière. Découvrez les pièces disponibles et leurs détails."}
          </p>
        </div>
      </section>
      <section className="catalog-body page-width">
        <div className="catalog-toolbar">
          <div className="catalog-tabs" aria-label="Disponibilité">
            {(!prints ? ["all", "available"] : ["all"]).map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f === "all" ? "Toutes les œuvres" : "Disponibles"}
              </button>
            ))}
          </div>
          <label className="sort-label">
            Trier par
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="selection">Sélection de l’atelier</option>
              <option value="asc">Prix croissant</option>
              <option value="desc">Prix décroissant</option>
            </select>
          </label>
        </div>
        {items.length ? (
          <div className="catalog-grid">
            {items.map(({ work, product }) => (
              <WorkCard
                key={product?.id || work.id}
                work={work}
                product={product}
                type={type}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Symbol />
            <h2>
              {filter === "available"
                ? "Les œuvres se préparent."
                : "La sélection se prépare."}
            </h2>
            <p>
              {filter === "available"
                ? "Les disponibilités seront précisées prochainement. En attendant, découvrez les compositions de l’atelier."
                : "Les nouvelles pièces seront présentées ici."}
            </p>
            {filter === "available" ? (
              <button
                className="button secondary"
                onClick={() => setFilter("all")}
              >
                Voir toutes les œuvres
                <Icon />
              </button>
            ) : (
              <ButtonLink href="/contact">Me poser une question</ButtonLink>
            )}
          </div>
        )}
        {prints && (
          <div className="catalog-note">
            <span className="eyebrow">À propos des tirages</span>
            <p>
              Les formats, le papier et le procédé d’impression seront précisés
              après validation des épreuves. Une reproduction restitue la
              composition, sans promettre le relief de l’original.
            </p>
          </div>
        )}
      </section>
      <ContactInvitation />
    </>
  );
}
function Zoom({ work, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const last = document.activeElement,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
      last?.focus();
    };
  }, []);
  return (
    <div
      className="zoom-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Vue agrandie de ${work.reference}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        ref={ref}
        className="zoom-close icon-button"
        onClick={onClose}
        aria-label="Fermer la vue agrandie"
      >
        <Icon name="close" />
      </button>
      <ArtImage work={work} priority sizes="90vw" />
      <p>{work.reference} — Vue complète</p>
    </div>
  );
}
function Detail({ slug, type }) {
  const { data, add } = useContext(Site);
  const p = data.products.find((p) => p.slug === slug && p.type === type);
  const work = [...works, ...(data.media || [])].find(
    (w) => w.image === p?.image || w.id === slug,
  );
  const [zoom, setZoom] = useState(false);
  const [variant, setVariant] = useState("");
  useEffect(() => {
    setVariant("");
    setZoom(false);
  }, [slug]);
  if (!work || (!p && data.mode !== "preview")) return <NotFound />;
  const canBuy = p?.status === "available";
  const v =
    type === "print" ? p?.variants.find((v) => v.format === variant) : p;
  return (
    <>
      <section className="detail-section page-width">
        <div className="breadcrumbs">
          <Link href={type === "print" ? "/reproductions" : "/originaux"}>
            {type === "print" ? "Reproductions" : "Originaux"}
          </Link>
          <span>/</span>
          <span>{p?.title || work.reference}</span>
        </div>
        <div className="detail-grid">
          <div className="detail-gallery">
            <button
              className="detail-main"
              onClick={() => setZoom(true)}
              aria-label="Agrandir la vue complète"
            >
              <ArtImage
                work={work}
                priority
                sizes="(max-width: 700px) 90vw, 50vw"
              />
              <span className="zoom-hint">
                <Icon name="zoom" />
                Voir de plus près
              </span>
            </button>
            <div className="detail-thumbs">
              <button
                className="selected"
                onClick={() => setZoom(true)}
                aria-label="Agrandir la vue complète"
              >
                <ArtImage work={work} />
              </button>
              <button
                onClick={() => setZoom(true)}
                className="detail-thumb"
                aria-label="Ouvrir la vue complète pour examiner les détails"
              >
                <ArtImage work={work} detail />
              </button>
              <span>Vue complète & matière</span>
            </div>
          </div>
          <div className="detail-copy">
            <p className="eyebrow">
              {type === "print" ? "Reproduction" : "Œuvre originale"} · Sirius
            </p>
            <h1>{p?.title || work.reference}</h1>
            <p className="detail-description">
              {p?.description ||
                (type === "print"
                  ? "Une composition de mon univers, à découvrir autrement. Les caractéristiques du tirage seront précisées après validation de l’épreuve."
                  : "Les formes se répondent, les couches se superposent et les traces du geste restent visibles.")}
            </p>
            {p?.width && (
              <dl className="specs">
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {p.width} × {p.height} cm
                  </dd>
                </div>
                {p.technique && (
                  <div>
                    <dt>Technique</dt>
                    <dd>{p.technique}</dd>
                  </div>
                )}
                {p.support && (
                  <div>
                    <dt>Support</dt>
                    <dd>{p.support}</dd>
                  </div>
                )}
                {p.year && (
                  <div>
                    <dt>Année</dt>
                    <dd>{p.year}</dd>
                  </div>
                )}
              </dl>
            )}
            {type === "print" && p?.variants?.length > 0 && (
              <fieldset className="format-selector">
                <legend>Choisir un format</legend>
                {p.variants.map((v) => (
                  <button
                    key={v.format}
                    disabled={!v.stock}
                    aria-pressed={variant === v.format}
                    className={variant === v.format ? "active" : ""}
                    onClick={() => setVariant(v.format)}
                  >
                    {v.format}
                    <span>{money(v.price)}</span>
                  </button>
                ))}
                {v && (
                  <p>
                    {v.width} × {v.height} cm · {v.paper} · {v.process}
                  </p>
                )}
              </fieldset>
            )}
            {canBuy ? (
              <div className="purchase-panel">
                <p className="product-price">
                  {v ? money(v.price) : "Sélectionnez un format"}
                </p>
                <p className="small-copy">
                  {data.settings.taxDescription}. Livraison calculée avant
                  paiement.
                </p>
                <button
                  className="button full"
                  disabled={!v || !v.stock}
                  onClick={() => add(p, variant)}
                >
                  {v?.stock ? "Ajouter au panier" : "Choisir un format"}
                  <Icon name="bag" />
                </button>
              </div>
            ) : (
              <div className="availability-note">
                <span className="status-dot" />
                <p>
                  {p?.status === "sold"
                    ? "Cette œuvre est vendue."
                    : p?.status === "reserved"
                      ? "Cette œuvre est réservée temporairement."
                      : "Pour connaître les détails de cette composition, échangeons."}
                </p>
              </div>
            )}
            {((!p && data.mode === "preview") ||
              (p?.status === "available" &&
                (type === "print"
                  ? p.variants?.some((item) => item.stock > 0)
                  : p.stock > 0))) && (
              <div className="detail-room-link">
                <ButtonLink
                  secondary
                  href={`/chez-moi?oeuvre=${encodeURIComponent(p?.id || work.id)}${variant ? `&format=${encodeURIComponent(variant)}` : ""}`}
                >
                  Voir l’œuvre chez moi
                </ButtonLink>
              </div>
            )}
            <TextLink href={`/contact?oeuvre=${work.reference}`}>
              Me poser une question
            </TextLink>
            <div className="detail-delivery">
              <Icon name="bag" />
              <p>
                Une question sur le format ou la livraison ?<br />
                <Link href="/livraison-retours">
                  Consulter les informations de livraison
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="related-section page-width">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Le dialogue continue</p>
            <h2>
              D’autres <em>compositions.</em>
            </h2>
          </div>
          <TextLink href={type === "print" ? "/reproductions" : "/originaux"}>
            Explorer la sélection
          </TextLink>
        </div>
        <div className="related-grid">
          {works
            .filter((w) => w.id !== work.id)
            .slice(0, 3)
            .map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                product={data.products.find(
                  (p) => p.image === w.image && p.type === type,
                )}
                type={type}
              />
            ))}
        </div>
      </section>
      {zoom && <Zoom work={work} onClose={() => setZoom(false)} />}
    </>
  );
}
function About() {
  const { data } = useContext(Site);
  const paragraphs = data.settings.aboutText?.trim()
    ? data.settings.aboutText.split(/\n\s*\n/)
    : biography;
  return (
    <>
      <section className="about-intro page-width">
        <p className="eyebrow">À propos · Sirius</p>
        <h1>
          Suivre le geste.
          <br />
          <em>Trouver l’équilibre.</em>
        </h1>
        <div className="about-grid">
          <div className="about-visual">
            <ArtImage work={works[2]} priority />
            <p className="eyebrow">Les formes, les couleurs, les espaces.</p>
          </div>
          <div className="about-text">
            <h2>
              Je suis <em>Sirius.</em>
            </h2>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <TextLink href="/originaux">Découvrir les originaux</TextLink>
          </div>
        </div>
      </section>
      <ContactInvitation />
    </>
  );
}
function Contact() {
  const { url, data } = useContext(Site);
  const reference = new URLSearchParams(url.split("?")[1]).get("oeuvre");
  const [fields, setFields] = useState({
    name: "",
    email: "",
    subject: reference ? `À propos de ${reference}` : "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const feedbackRef = useRef(null);
  useEffect(() => {
    if (reference)
      setFields((f) => ({ ...f, subject: `À propos de ${reference}` }));
  }, [reference]);
  async function submit(e) {
    e.preventDefault();
    const err = {};
    if (!fields.name.trim()) err.name = "Indiquez votre nom.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      err.email = "Indiquez une adresse e-mail valide.";
    if (!fields.subject.trim())
      err.subject = "Indiquez le sujet de votre message.";
    if (fields.message.trim().length < 10)
      err.message = "Votre message doit contenir au moins 10 caractères.";
    setErrors(err);
    if (Object.keys(err).length) {
      setTimeout(() =>
        document.querySelector('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, reference }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(
          body.error || "Le message n’a pas pu être envoyé. Réessayez.",
        );
      setState(body.sent ? "sent" : "saved");
      setFeedback(body.message);
      setFields({ name: "", email: "", subject: "", message: "", website: "" });
      setTimeout(() => feedbackRef.current?.focus());
    } catch (err) {
      setState("error");
      setFeedback(err.message);
    }
  }
  const input = (name, label, kind = "text") => (
    <div className="form-field">
      <label htmlFor={`contact-${name}`}>{label}</label>
      {kind === "textarea" ? (
        <textarea
          id={`contact-${name}`}
          name={name}
          value={fields[name]}
          onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
          rows="6"
          maxLength="5000"
          required
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        />
      ) : (
        <input
          id={`contact-${name}`}
          name={name}
          type={kind}
          autoComplete={
            name === "name" ? "name" : name === "email" ? "email" : "off"
          }
          value={fields[name]}
          onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
          required
          maxLength={name === "email" ? 254 : 200}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        />
      )}{" "}
      {errors[name] && (
        <span className="field-error" id={`${name}-error`}>
          {errors[name]}
        </span>
      )}
    </div>
  );
  return (
    <section className="contact-page page-width">
      <div className="contact-page-copy">
        <p className="eyebrow">Un échange, simplement</p>
        <h1>
          Me <em>contacter.</em>
        </h1>
        <p>
          Une question sur une œuvre, un format ou une livraison ? Écrivez-moi
          en précisant la pièce qui vous intéresse.
        </p>
        {data.settings.sellerEmail && (
          <a className="text-link" href={`mailto:${data.settings.sellerEmail}`}>
            {data.settings.sellerEmail}
            <Icon />
          </a>
        )}
        <div className="contact-art">
          <ArtImage work={works[3]} detail />
          <span className="eyebrow">
            Chaque échange commence par un regard.
          </span>
        </div>
      </div>
      <form className="contact-form" onSubmit={submit} noValidate>
        <p className="eyebrow">Votre message</p>
        <div className="form-two">
          {input("name", "Votre nom")}
          {input("email", "Votre adresse e-mail", "email")}
        </div>
        {input("subject", "Sujet")}
        {input("message", "Votre message", "textarea")}
        <div className="honeypot" aria-hidden="true">
          <label>
            Site web
            <input
              name="website"
              tabIndex="-1"
              autoComplete="off"
              value={fields.website}
              onChange={(e) =>
                setFields({ ...fields, website: e.target.value })
              }
            />
          </label>
        </div>
        <p className="form-privacy">
          Vos informations sont utilisées uniquement pour répondre à votre
          demande. <Link href="/confidentialite">En savoir plus</Link>.
        </p>
        <button className="button" disabled={state === "loading"} type="submit">
          {state === "loading" ? "Envoi en cours…" : "Envoyer mon message"}
          <Icon />
        </button>
        {feedback && (
          <p
            ref={feedbackRef}
            tabIndex="-1"
            role={state === "error" ? "alert" : "status"}
            className={`form-feedback ${state === "error" ? "error" : ""}`}
          >
            {feedback}
          </p>
        )}
      </form>
    </section>
  );
}
function Cart() {
  const { cart, setCart, data } = useContext(Site);
  const items = cart
    .map((l) => ({ ...l, product: data.products.find((p) => p.id === l.id) }))
    .filter((l) => l.product);
  const total = items.reduce(
    (s, l) =>
      s +
      (l.product.type === "print"
        ? l.product.variants.find((v) => v.format === l.variant)?.price || 0
        : l.product.price || 0) *
        l.quantity,
    0,
  );
  return (
    <section className="cart-page page-width">
      <p className="eyebrow">Votre sélection</p>
      <h1>
        Le <em>panier.</em>
      </h1>
      {!items.length ? (
        <div className="empty-state">
          <Icon name="bag" width="44" height="44" />
          <h2>
            Une place pour vos <em>coups de cœur.</em>
          </h2>
          <p>
            Votre panier est encore vide.
            <br />
            Prenez le temps de découvrir les œuvres.
          </p>
          <ButtonLink href="/originaux">Découvrir les originaux</ButtonLink>
        </div>
      ) : (
        <div className="cart-layout">
          <div>
            {items.map((l) => (
              <article key={l.id + l.variant} className="cart-item">
                <ArtImage
                  work={[...works, ...(data.media || [])].find(
                    (w) => w.image === l.product.image,
                  )}
                />
                <div>
                  <Link
                    href={`/${l.product.type === "print" ? "reproductions" : "originaux"}/${l.product.slug}`}
                  >
                    {l.product.title}
                  </Link>
                  <p>{l.variant || "Œuvre originale"}</p>
                  {l.product.type === "print" && (
                    <label>
                      Quantité{" "}
                      <input
                        aria-label={`Quantité pour ${l.product.title}`}
                        type="number"
                        min="1"
                        max="20"
                        value={l.quantity}
                        onChange={(e) =>
                          setCart(
                            cart.map((c) =>
                              c.id === l.id && c.variant === l.variant
                                ? {
                                    ...c,
                                    quantity: Math.max(
                                      1,
                                      Math.min(20, Number(e.target.value) || 1),
                                    ),
                                  }
                                : c,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <button
                    className="remove-button"
                    onClick={() =>
                      setCart(
                        cart.filter(
                          (c) => !(c.id === l.id && c.variant === l.variant),
                        ),
                      )
                    }
                  >
                    Retirer
                  </button>
                </div>
                <strong>
                  {money(
                    (l.product.type === "print"
                      ? l.product.variants.find((v) => v.format === l.variant)
                          .price
                      : l.product.price) * l.quantity,
                  )}
                </strong>
              </article>
            ))}
          </div>
          <aside className="cart-summary">
            <h2>Votre sélection</h2>
            <div>
              <span>Sous-total</span>
              <span>{money(total)}</span>
            </div>
            <p>
              La destination et les frais de livraison seront vérifiés avant
              paiement.
            </p>
            <ButtonLink href="/commande">Poursuivre la commande</ButtonLink>
            <TextLink href="/originaux">Continuer ma découverte</TextLink>
          </aside>
        </div>
      )}
    </section>
  );
}
function Checkout() {
  const { data, cart } = useContext(Site);
  const expectedTotal =
    cart.reduce((sum, l) => {
      const p = data.products.find((p) => p.id === l.id);
      const price =
        p?.type === "print"
          ? p.variants.find((v) => v.format === l.variant)?.price
          : p?.price;
      return sum + (price || 0) * l.quantity;
    }, 0) + (data.settings.shippingCents || 0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const address = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: cart, address, expectedTotal }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      window.location.assign(b.url);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }
  return (
    <section className="checkout-page page-width">
      <p className="eyebrow">Votre sélection · Commande</p>
      <h1>
        Les derniers <em>détails.</em>
      </h1>
      {!cart.length ? (
        <div className="empty-state">
          <p>Votre panier est vide.</p>
          <ButtonLink href="/originaux">Découvrir les œuvres</ButtonLink>
        </div>
      ) : !data.settings.commerceEnabled ? (
        <div className="empty-state">
          <h2>La vente se prépare.</h2>
          <p>
            Pour toute question sur une œuvre ou votre destination,
            contactez-moi.
          </p>
          <ButtonLink href="/contact">Me contacter</ButtonLink>
        </div>
      ) : (
        <form onSubmit={submit} className="checkout-form">
          <h2>Vos coordonnées</h2>
          {[
            ["name", "Nom complet"],
            ["email", "Adresse e-mail"],
            ["street", "Adresse"],
            ["postalCode", "Code postal"],
            ["city", "Ville"],
          ].map(([name, label]) => (
            <div className="form-field" key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                name={name}
                required
                type={name === "email" ? "email" : "text"}
                maxLength="250"
              />
            </div>
          ))}
          <div className="form-field">
            <label htmlFor="country">Pays de livraison</label>
            <select id="country" name="country" required>
              <option value="">Choisir une destination</option>
              {data.settings.countries.map((c) => (
                <option key={c} value={c}>
                  {new Intl.DisplayNames("fr", { type: "region" }).of(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="checkout-summary">
            <h2>Votre sélection</h2>
            {cart.map((l) => {
              const p = data.products.find((p) => p.id === l.id);
              const price =
                p?.type === "print"
                  ? p.variants.find((v) => v.format === l.variant)?.price
                  : p?.price;
              return (
                <p key={l.id + l.variant}>
                  {p?.title || "Article indisponible"} {l.variant} ×{" "}
                  {l.quantity} — {money((price || 0) * l.quantity)}
                </p>
              );
            })}
            <p>
              Total :{" "}
              {money(
                cart.reduce((sum, l) => {
                  const p = data.products.find((p) => p.id === l.id);
                  const price =
                    p?.type === "print"
                      ? p.variants.find((v) => v.format === l.variant)?.price
                      : p?.price;
                  return sum + (price || 0) * l.quantity;
                }, 0) + (data.settings.shippingCents || 0),
              )}
            </p>
            <p className="small-copy">{data.settings.taxDescription}</p>
          </div>
          <p>
            Livraison : {money(data.settings.shippingCents)} ·{" "}
            {data.settings.shippingDelay}
          </p>
          <label className="checkbox-label">
            <input type="checkbox" name="terms" required />
            J’accepte les <Link href="/cgv">conditions générales de vente</Link>
            .
          </label>
          <button className="button" disabled={loading}>
            {loading ? "Préparation…" : "Commander et payer"}
            <Icon />
          </button>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
function OrderResult() {
  const { url, setCart } = useContext(Site);
  const params = new URLSearchParams(url.split("?")[1]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const id = params.get("id"),
      token = params.get("token");
    if (!id || !token) {
      setError("Aucune commande à afficher.");
      return;
    }
    let stopped = false;
    const get = async () => {
      try {
        const r = await fetch(
          `/api/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
        );
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        if (!stopped) {
          setResult(b);
          if (["paid", "shipped"].includes(b.status)) setCart([]);
        }
      } catch (e) {
        if (!stopped) setError(e.message);
      }
    };
    if (params.get("annule") === "1") {
      fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).finally(get);
    } else get();
    const timer = setInterval(get, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [url]);
  return (
    <section className="result-page page-width">
      <p className="eyebrow">Commande</p>
      <h1>
        {["paid", "shipped"].includes(result?.status) ? (
          <>
            Merci pour votre <em>confiance.</em>
          </>
        ) : result?.status === "cancelled" || result?.status === "expired" ? (
          <>
            Votre commande est <em>non payée.</em>
          </>
        ) : (
          <>
            Le statut de votre <em>commande.</em>
          </>
        )}
      </h1>
      {error ? (
        <p>{error}</p>
      ) : result ? (
        <>
          <p>
            {["paid", "shipped"].includes(result.status)
              ? "Le paiement de votre commande est confirmé."
              : result.status === "refunded"
                ? "Votre remboursement est confirmé."
                : result.status === "pending"
                  ? "La confirmation du paiement est en cours. Votre commande n’est pas encore confirmée."
                  : "Le paiement n’a pas été confirmé. Vous pouvez revenir à votre panier."}
          </p>
          <p>Référence : {result.id}</p>
          {result.lines.map((l) => (
            <p key={l.id + l.variant}>
              {l.title} {l.variant} × {l.quantity} —{" "}
              {money(l.price * l.quantity)}
            </p>
          ))}
          {result.status === "shipped" && (
            <p>Votre commande est expédiée. Suivi : {result.tracking}</p>
          )}
          <p>
            Total : {money(result.total)} · Livraison : {money(result.shipping)}
          </p>
          <p>
            {result.address.name} · {result.address.street},{" "}
            {result.address.postalCode} {result.address.city},{" "}
            {result.address.country}
          </p>
        </>
      ) : (
        <p>Vérification du statut…</p>
      )}
      <ButtonLink href="/originaux">Revenir aux œuvres</ButtonLink>
    </section>
  );
}
function Information({ page }) {
  const { data } = useContext(Site);
  const s = data.settings;
  const content = {
    "/livraison-retours": {
      label: "Livraison et retours",
      title: (
        <>
          Prendre soin
          <br />
          de votre <em>œuvre.</em>
        </>
      ),
      sections: [
        [
          "Livraison",
          s.countries?.length
            ? `Pays desservis : ${s.countries.map((c) => new Intl.DisplayNames("fr", { type: "region" }).of(c)).join(", ")}. Frais de livraison : ${money(s.shippingCents)}. ${s.shippingDelay}`
            : "Les destinations, les frais et les délais seront précisés avant l’ouverture des ventes. Aucune livraison n’est annoncée sans confirmation.",
        ],
        [
          "Une destination particulière ?",
          "Si votre pays n’est pas proposé, écrivez-moi en précisant l’œuvre qui vous intéresse. Livraison à confirmer pour votre destination.",
        ],
        [
          "Retours",
          "Les modalités de retour et de rétractation seront publiées avec les conditions de vente avant toute commande. Un original n’est pas exclu du droit de rétractation du seul fait qu’il est unique.",
        ],
      ],
    },
    "/mentions-legales": {
      label: "Mentions légales",
      title: (
        <>
          Mentions <em>légales.</em>
        </>
      ),
      sections: [
        [
          "Éditeur du site",
          s.legal ||
            "Ce site présente l’univers de Sirius en préproduction. Les informations légales du vendeur seront complétées avant l’ouverture des ventes.",
        ],
        [
          "Crédits",
          "Œuvres et identité visuelle : Sirius. Typographies : Latin Modern Roman et Nimbus Sans.",
        ],
        [
          "Nous contacter",
          "Pour poser une question, utilisez le formulaire de contact.",
        ],
      ],
    },
    "/cgv": {
      label: "Conditions générales de vente",
      title: (
        <>
          Conditions
          <br />
          de <em>vente.</em>
        </>
      ),
      sections: [
        [
          "Ouverture des ventes",
          s.terms ||
            "Les ventes ne sont pas ouvertes. Les conditions générales seront complétées et validées avant toute commande. Aucun paiement réel n’est proposé dans cette version.",
        ],
        [
          "Avant votre commande",
          "Les caractéristiques, le prix public, le traitement des taxes, les frais et les délais de livraison seront indiqués avant tout paiement.",
        ],
        [
          "Une question ?",
          "Contactez-moi pour échanger sur une œuvre, un format ou une destination.",
        ],
      ],
    },
    "/confidentialite": {
      label: "Données personnelles",
      title: (
        <>
          Votre <em>confidentialité.</em>
        </>
      ),
      sections: [
        [
          "Vos informations",
          s.privacy ||
            "Le formulaire recueille votre nom, votre adresse e-mail, le sujet et le contenu de votre message pour permettre le traitement de votre demande. Les informations sont enregistrées dans le journal de contact du site. Les modalités de conservation et l’identité du responsable seront complétées avant ouverture publique.",
        ],
        [
          "Cookies et traceurs",
          "Ce site ne charge aucun traceur publicitaire ou analytique. Le panier est conservé dans votre navigateur, uniquement pour mémoriser votre sélection. Aucun bandeau de consentement n’est nécessaire pour cette configuration.",
        ],
        [
          "Vos droits",
          "Pour toute demande concernant vos informations, utilisez le formulaire de contact en indiquant l’objet de votre demande.",
        ],
      ],
    },
  };
  const c = content[page];
  return (
    <section className="information-page page-width">
      <p className="eyebrow">{c.label}</p>
      <h1>{c.title}</h1>
      <div className="information-body">
        {c.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p className="preserve-lines">{text}</p>
          </section>
        ))}
        <TextLink href="/contact">Me contacter</TextLink>
      </div>
    </section>
  );
}
function NotFound() {
  return (
    <section className="empty-state page-width">
      <p className="eyebrow">404</p>
      <h1>
        Un chemin de <em>traverse.</em>
      </h1>
      <p>Cette page n’existe pas ou n’est plus disponible.</p>
      <ButtonLink href="/">Revenir à l’accueil</ButtonLink>
    </section>
  );
}
function Route() {
  const { url, data } = useContext(Site);
  const path = url.split("?")[0].replace(/\/$/, "") || "/";
  if (path === "/") return <Home />;
  if (path === "/originaux") return <Catalog type="original" />;
  if (path === "/reproductions") return <Catalog type="print" />;
  if (path === "/chez-moi") return <RoomView data={data} url={url} />;
  if (path.startsWith("/originaux/"))
    return <Detail slug={decodeURIComponent(path.slice(11))} type="original" />;
  if (path.startsWith("/reproductions/"))
    return <Detail slug={decodeURIComponent(path.slice(15))} type="print" />;
  if (path === "/a-propos") return <About />;
  if (path === "/contact") return <Contact />;
  if (path === "/panier") return <Cart />;
  if (path === "/commande") return <Checkout />;
  if (path === "/commande/resultat") return <OrderResult />;
  if (
    [
      "/livraison-retours",
      "/mentions-legales",
      "/cgv",
      "/confidentialite",
    ].includes(path)
  )
    return <Information page={path} />;
  if (path === "/admin") return <Admin />;
  return <NotFound />;
}
export function App({ initialData, initialUrl = "/" }) {
  const [url, setUrl] = useState(initialUrl);
  const [data, setData] = useState(initialData);
  const [cart, setCart] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const navigate = (href) => {
    window.history.pushState({}, "", href);
    setUrl(href);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const back = () => {
      setUrl(window.location.pathname + window.location.search);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", back);
    try {
      const saved = JSON.parse(localStorage.getItem("sirius-cart") || "[]");
      if (Array.isArray(saved))
        setCart(
          saved
            .filter(
              (l) =>
                typeof l.id === "string" &&
                typeof l.variant === "string" &&
                Number.isSafeInteger(l.quantity) &&
                l.quantity > 0 &&
                l.quantity <= 20,
            )
            .slice(0, 30),
        );
    } catch {}
    setLoaded(true);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem("sirius-cart", JSON.stringify(cart));
      } catch {}
  }, [cart, loaded]);
  useEffect(() => {
    const p = url.split("?")[0];
    const titles = {
      "/": "Sirius — La matière, en équilibre.",
      "/originaux": "Œuvres originales — Sirius",
      "/reproductions": "Reproductions — Sirius",
      "/chez-moi": "Voir l’œuvre chez moi — Sirius",
      "/a-propos": "À propos — Sirius",
      "/contact": "Me contacter — Sirius",
      "/panier": "Votre panier — Sirius",
      "/commande": "Commande — Sirius",
      "/admin": "Administration — Sirius",
    };
    document.title =
      titles[p] ||
      `${p.includes("art-") ? p.split("/").at(-1).toUpperCase() : "Sirius"} — Sirius`;
    if (loaded)
      document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [url]);
  function add(p, variant = "") {
    setCart((current) => {
      const exists = current.find(
        (l) => l.id === p.id && l.variant === variant,
      );
      if (exists)
        return current.map((l) =>
          l.id === p.id && l.variant === variant
            ? {
                ...l,
                quantity:
                  p.type === "original"
                    ? 1
                    : Math.min(
                        l.quantity + 1,
                        p.variants.find((v) => v.format === variant).stock,
                        20,
                      ),
              }
            : l,
        );
      return [...current, { id: p.id, variant, quantity: 1 }];
    });
    setToast("L’œuvre a été ajoutée à votre panier.");
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }
  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((next) => {
        if (!cancelled && Array.isArray(next.products)) setData(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);
  const onClick = (e) => {
    const a = e.target.closest("a[data-nav]");
    if (
      a &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      !e.altKey &&
      e.button === 0
    ) {
      e.preventDefault();
      navigate(a.getAttribute("href"));
    }
  };
  return (
    <Site.Provider value={{ url, data, cart, setCart, navigate, add }}>
      <div onClick={onClick}>
        <a className="skip-link" href="#main-content">
          Aller au contenu
        </a>
        <Header />
        <main id="main-content" tabIndex="-1">
          <Route />
        </main>
        <Footer />
        {toast && (
          <div className="toast" role="status">
            <Icon name="check" />
            <span>{toast}</span>
            <Link href="/panier">Voir le panier</Link>
            <button
              className="icon-button"
              onClick={() => setToast("")}
              aria-label="Fermer la notification"
            >
              <Icon name="close" />
            </button>
          </div>
        )}
      </div>
    </Site.Provider>
  );
}
