import React, { useEffect, useState } from "react";
import { ArtImage, Icon } from "./App";
import { works, money } from "./content";
export function Admin() {
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("products");
  const [edit, setEdit] = useState(null);
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const allMedia = [...works, ...(data?.media || [])];
  async function api(path, method = "GET", body) {
    const r = await fetch(`/api/admin${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Sirius-Request": "admin",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const b = await r.json();
    if (!r.ok)
      throw new Error(b.error || "La demande n’a pas pu être traitée.");
    return b;
  }
  async function refresh() {
    const b = await api("/data");
    setData(b);
    setSettings(b.settings);
    setAuthenticated(true);
    setEdit(
      (previous) =>
        b.products.find((p) => p.id === previous?.id) || b.products[0],
    );
  }
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  async function login(e) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await api("/login", "POST", { password });
      setPassword("");
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api(`/products/${edit.id}`, "PUT", edit);
      await refresh();
      setMessage("Les informations de l’œuvre ont été enregistrées.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/settings", "PUT", settings);
      await refresh();
      setMessage("Les paramètres ont été enregistrés.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  function field(obj, setter, key, label, type = "text") {
    return (
      <div className="form-field">
        <label htmlFor={`admin-${key}`}>{label}</label>
        {type === "textarea" ? (
          <textarea
            id={`admin-${key}`}
            rows="5"
            value={obj[key] ?? ""}
            onChange={(e) => setter({ ...obj, [key]: e.target.value })}
          />
        ) : (
          <input
            id={`admin-${key}`}
            type={type}
            min={type === "number" ? "0" : undefined}
            step={type === "number" ? "any" : undefined}
            value={obj[key] ?? ""}
            onChange={(e) =>
              setter({
                ...obj,
                [key]:
                  type === "number"
                    ? e.target.value === ""
                      ? null
                      : Number(e.target.value)
                    : e.target.value,
              })
            }
          />
        )}
      </div>
    );
  }
  return (
    <section className="admin-page page-width">
      <p className="eyebrow">L’atelier · Espace privé</p>
      <h1>
        Votre <em>atelier.</em>
      </h1>
      {!loaded ? (
        <p>Chargement de l’espace privé…</p>
      ) : !authenticated ? (
        <form className="admin-login" onSubmit={login}>
          <p>
            Connectez-vous pour gérer les œuvres, les paramètres de vente et les
            messages.
          </p>
          <div className="form-field">
            <label htmlFor="admin-password">Mot de passe</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="button" disabled={busy}>
            Se connecter
            <Icon />
          </button>
          {message && (
            <p className="field-error" role="alert">
              {message}
            </p>
          )}
        </form>
      ) : (
        <>
          <nav className="admin-toolbar" aria-label="Administration">
            {[
              ["products", "Œuvres"],
              ["media", "Médias"],
              ["settings", "Paramètres"],
              ["contacts", "Messages"],
              ["orders", "Commandes"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setMessage("");
                }}
                className={tab === id ? "active" : ""}
                aria-pressed={tab === id}
              >
                {label}
              </button>
            ))}
            <button
              className="logout"
              onClick={async () => {
                await api("/logout", "POST");
                setAuthenticated(false);
                setData(null);
              }}
            >
              Se déconnecter
            </button>
          </nav>
          <div className="admin-actions">
            <a className="text-link" href="/api/admin/export/products">
              Exporter les œuvres
              <Icon />
            </a>
            <a className="text-link" href="/api/admin/export/contacts">
              Exporter les contacts
              <Icon />
            </a>
            <a className="text-link" href="/api/admin/export/orders">
              Exporter les commandes
              <Icon />
            </a>
          </div>
          {message && (
            <p className="admin-message" role="status">
              {message}
            </p>
          )}
          {tab === "products" && edit && (
            <div className="admin-layout">
              <aside className="admin-product-list">
                {data.products.map((p) => (
                  <button
                    className={edit.id === p.id ? "active" : ""}
                    key={p.id}
                    onClick={() => {
                      setEdit({ ...p });
                      setMessage("");
                    }}
                  >
                    <ArtImage
                      work={allMedia.find((w) => w.image === p.image)}
                    />
                    <span>
                      {p.title || p.reference}
                      <small>
                        {p.status === "draft"
                          ? "Brouillon"
                          : p.status === "informative"
                            ? "Fiche informative"
                            : p.status === "available"
                              ? "Disponible"
                              : p.status === "sold"
                                ? "Vendue"
                                : "Archivée"}
                      </small>
                    </span>
                  </button>
                ))}
                <button
                  onClick={() =>
                    setEdit({
                      id: `art-${Date.now()}`,
                      slug: `composition-${Date.now()}`,
                      reference: "",
                      title: "",
                      image: "art-001",
                      type: "original",
                      status: "draft",
                      description: "",
                      technique: "",
                      support: "",
                      year: "",
                      width: "",
                      height: "",
                      price: null,
                      stock: 0,
                      variants: [],
                      featured: false,
                    })
                  }
                >
                  <Icon name="plus" />
                  Ajouter une fiche
                </button>
              </aside>
              <form className="admin-editor" onSubmit={saveProduct}>
                <h2>{edit.title || edit.reference || "Nouvelle fiche"}</h2>
                <div className="form-two">
                  {field(edit, setEdit, "title", "Titre public")}
                  {field(edit, setEdit, "reference", "Référence")}
                  {field(edit, setEdit, "slug", "Adresse de la fiche")}
                  <div className="form-field">
                    <label htmlFor="admin-type">Type</label>
                    <select
                      id="admin-type"
                      value={edit.type}
                      onChange={(e) =>
                        setEdit({ ...edit, type: e.target.value })
                      }
                    >
                      <option value="original">Original</option>
                      <option value="print">Reproduction</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="admin-image">Vue complète</label>
                    <select
                      id="admin-image"
                      value={edit.image}
                      onChange={(e) =>
                        setEdit({ ...edit, image: e.target.value })
                      }
                    >
                      {allMedia.map((w) => (
                        <option key={w.id} value={w.image}>
                          {w.reference || w.alt.slice(0, 45)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="admin-status">Publication</label>
                    <select
                      id="admin-status"
                      value={edit.status}
                      onChange={(e) =>
                        setEdit({ ...edit, status: e.target.value })
                      }
                    >
                      <option value="draft">Brouillon — invisible</option>
                      <option value="informative">
                        Fiche informative — sans vente
                      </option>
                      <option value="available">Disponible — vente</option>
                      <option value="reserved">Réservée</option>
                      <option value="sold">Vendue</option>
                      <option value="archived">Archivée — invisible</option>
                    </select>
                  </div>
                </div>
                {field(edit, setEdit, "description", "Description", "textarea")}
                <div className="form-two">
                  {field(edit, setEdit, "technique", "Technique")}
                  {field(edit, setEdit, "support", "Support")}
                  {field(edit, setEdit, "year", "Année")}
                  {field(edit, setEdit, "width", "Largeur en cm", "number")}
                  {field(edit, setEdit, "height", "Hauteur en cm", "number")}
                  {edit.type === "original" && (
                    <>
                      {field(
                        edit,
                        setEdit,
                        "price",
                        "Prix public en centimes (EUR)",
                        "number",
                      )}
                      {field(
                        edit,
                        setEdit,
                        "stock",
                        "Stock — 1 maximum pour un original",
                        "number",
                      )}
                    </>
                  )}
                </div>
                {edit.type === "print" && (
                  <>
                    <h3>Formats des reproductions</h3>
                    {edit.variants.map((v, i) => (
                      <div className="admin-variant" key={i}>
                        <h3>Format {i + 1}</h3>
                        <div className="form-two">
                          {[
                            "format",
                            "paper",
                            "process",
                            "width",
                            "height",
                            "price",
                            "stock",
                          ].map((key) =>
                            field(
                              v,
                              (next) =>
                                setEdit({
                                  ...edit,
                                  variants: edit.variants.map((prev, j) =>
                                    j === i ? next : prev,
                                  ),
                                }),
                              key,
                              {
                                format: "Format",
                                paper: "Papier",
                                process: "Procédé",
                                width: "Largeur en cm",
                                height: "Hauteur en cm",
                                price: "Prix public en centimes",
                                stock: "Stock",
                              }[key],
                              ["width", "height", "price", "stock"].includes(
                                key,
                              )
                                ? "number"
                                : "text",
                            ),
                          )}
                        </div>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={!!v.proofApproved}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                variants: edit.variants.map((prev, j) =>
                                  j === i
                                    ? {
                                        ...prev,
                                        proofApproved: e.target.checked,
                                      }
                                    : prev,
                                ),
                              })
                            }
                          />
                          Épreuve d’impression approuvée
                        </label>
                        <button
                          type="button"
                          className="remove-button"
                          onClick={() =>
                            setEdit({
                              ...edit,
                              variants: edit.variants.filter((_, j) => i !== j),
                            })
                          }
                        >
                          Retirer ce format
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setEdit({
                          ...edit,
                          variants: [
                            ...edit.variants,
                            {
                              format: "",
                              paper: "",
                              process: "",
                              price: null,
                              stock: 0,
                              width: null,
                              height: null,
                              proofApproved: false,
                            },
                          ],
                        })
                      }
                    >
                      Ajouter un format
                      <Icon name="plus" />
                    </button>
                  </>
                )}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!edit.featured}
                    onChange={(e) =>
                      setEdit({ ...edit, featured: e.target.checked })
                    }
                  />
                  Afficher dans la sélection de l’accueil
                </label>
                <p className="form-privacy">
                  Les informations inconnues restent vides. Une fiche marchande
                  nécessite des caractéristiques, un prix, un stock et une
                  livraison validés.
                </p>
                <button className="button" disabled={busy}>
                  Enregistrer la fiche
                  <Icon name="check" />
                </button>
              </form>
            </div>
          )}
          {tab === "settings" && (
            <form className="admin-settings" onSubmit={saveSettings}>
              <h2>Paramètres de vente</h2>
              <div className="form-two">
                {field(
                  settings,
                  setSettings,
                  "sellerName",
                  "Identité légale du vendeur",
                )}
                {field(
                  settings,
                  setSettings,
                  "sellerEmail",
                  "Adresse e-mail de contact",
                  "email",
                )}
              </div>
              {field(
                settings,
                setSettings,
                "sellerAddress",
                "Adresse professionnelle",
                "textarea",
              )}
              {field(
                settings,
                setSettings,
                "taxDescription",
                "Traitement fiscal affiché",
              )}
              <div className="form-field">
                <label htmlFor="admin-countries">
                  Pays desservis — codes ISO séparés par des virgules
                </label>
                <input
                  id="admin-countries"
                  value={settings.countries.join(", ")}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      countries: e.target.value
                        .toUpperCase()
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="form-two">
                {field(
                  settings,
                  setSettings,
                  "shippingCents",
                  "Frais de livraison en centimes",
                  "number",
                )}
                {field(
                  settings,
                  setSettings,
                  "shippingDelay",
                  "Délais de préparation et livraison",
                )}
              </div>
              {field(
                settings,
                setSettings,
                "aboutText",
                "Biographie — paragraphes séparés par une ligne vide",
                "textarea",
              )}
              {field(
                settings,
                setSettings,
                "legal",
                "Mentions légales",
                "textarea",
              )}
              {field(
                settings,
                setSettings,
                "terms",
                "Conditions générales de vente",
                "textarea",
              )}
              {field(
                settings,
                setSettings,
                "privacy",
                "Politique de confidentialité",
                "textarea",
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.commerceEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      commerceEnabled: e.target.checked,
                    })
                  }
                />
                Activer les ventes en environnement de test
              </label>
              <p className="form-privacy">
                Le paiement nécessite un compte Stripe en mode test. Les comptes
                paiement et messagerie se configurent côté serveur.
              </p>
              <button className="button" disabled={busy}>
                Enregistrer les paramètres
                <Icon name="check" />
              </button>
            </form>
          )}
          {tab === "media" && (
            <>
              <h2>Votre bibliothèque</h2>
              <form
                className="admin-upload"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  setBusy(true);
                  setMessage("");
                  try {
                    const response = await fetch("/api/admin/media", {
                      method: "POST",
                      headers: { "X-Sirius-Request": "admin" },
                      body: new FormData(form),
                    });
                    const b = await response.json();
                    if (!response.ok) throw new Error(b.error);
                    await refresh();
                    form.reset();
                    setMessage(
                      "L’image a été importée et ses versions web préparées.",
                    );
                  } catch (e) {
                    setMessage(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-field">
                  <label htmlFor="media-file">
                    Image (PNG, JPEG, WebP, AVIF · 20 Mo maximum)
                  </label>
                  <input
                    id="media-file"
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="media-alt">Description de l’image</label>
                  <input id="media-alt" name="alt" required maxLength="500" />
                </div>
                <button className="button" disabled={busy}>
                  Importer l’image
                  <Icon name="plus" />
                </button>
              </form>
              <div className="admin-media-grid">
                {allMedia.map((w) => (
                  <figure key={w.id}>
                    <ArtImage work={w} />
                    <figcaption>{w.reference || w.alt}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
          {tab === "contacts" && (
            <>
              <h2>Messages reçus</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Contact</th>
                    <th>Message</th>
                    <th>Envoi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contacts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {new Date(c.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td>
                        {c.data.name}
                        <br />
                        {c.data.email}
                      </td>
                      <td>
                        <strong>{c.data.subject}</strong>
                        <p>{c.data.message}</p>
                      </td>
                      <td>
                        {c.delivery === "sent"
                          ? "Pris en charge"
                          : c.delivery === "failed"
                            ? "Échec"
                            : "En attente"}
                        {c.delivery !== "sent" && (
                          <button
                            className="remove-button"
                            onClick={async () => {
                              try {
                                await api(`/contacts/${c.id}/retry`, "POST");
                                await refresh();
                                setMessage("L’envoi a été pris en charge.");
                              } catch (e) {
                                setMessage(e.message);
                              }
                            }}
                          >
                            Réessayer l’envoi
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.contacts.length && (
                <p className="admin-message">Aucun message pour le moment.</p>
              )}
            </>
          )}
          {tab === "orders" && (
            <>
              <h2>Commandes</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Articles</th>
                    <th>Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.id.slice(0, 8)}
                        <br />
                        {o.data.address.email}
                      </td>
                      <td>
                        {o.data.lines.map((l) => (
                          <p key={l.id + l.variant}>
                            {l.title} · {l.variant} × {l.quantity}
                          </p>
                        ))}
                      </td>
                      <td>{money(o.data.total)}</td>
                      <td>
                        {{
                          shipped: "Expédiée",
                          refunded: "Remboursée",
                          paid: "Payée",
                          pending: "En attente",
                          expired: "Expirée",
                          cancelled: "Annulée",
                        }[o.status] || o.status}
                        {o.status === "paid" && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const tracking = new FormData(
                                e.currentTarget,
                              ).get("tracking");
                              try {
                                await api(`/orders/${o.id}/ship`, "POST", {
                                  tracking,
                                });
                                await refresh();
                                setMessage("L’expédition a été enregistrée.");
                              } catch (e) {
                                setMessage(e.message);
                              }
                            }}
                          >
                            <input
                              name="tracking"
                              aria-label="Référence de suivi"
                              required
                              minLength="3"
                              maxLength="500"
                            />
                            <button className="remove-button">
                              Marquer comme expédiée
                            </button>
                          </form>
                        )}
                        {["paid", "shipped"].includes(o.status) && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const returnToStock =
                                new FormData(e.currentTarget).get("checked") ===
                                "on";
                              try {
                                await api(`/orders/${o.id}/refund`, "POST", {
                                  returnToStock,
                                });
                                await refresh();
                                setMessage("Le remboursement a été confirmé.");
                              } catch (e) {
                                setMessage(e.message);
                              }
                            }}
                          >
                            <label className="small-copy">
                              <input type="checkbox" name="checked" />
                              Retour contrôlé : remettre en stock
                            </label>
                            <button className="remove-button">
                              Rembourser en mode test
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.orders.length && (
                <p className="admin-message">Aucune commande pour le moment.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
