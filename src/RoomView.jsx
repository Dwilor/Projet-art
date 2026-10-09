import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArtImage, Icon } from "./App";
import { roomChoices, roomImage } from "./roomCatalog.js";
import { artworkRect, constrainPlacement, sizeLimits } from "./roomGeometry.js";

const readImage = (url) => {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
};
const imageBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("L’image n’a pas pu être préparée. Réessayez.")),
      "image/jpeg",
      0.92,
    );
  });
const initialPlacement = { x: 0.5, y: 0.4, width: 0.28 };

export function RoomView({ data, url }) {
  const choices = useMemo(() => roomChoices(data), [data]);
  const query = new URLSearchParams(url.split("?")[1] || "");
  const initialChoice =
    choices.find((choice) => choice.id === query.get("oeuvre")) ||
    choices.find((choice) => choice.work.id === query.get("oeuvre")) ||
    choices[0];
  const [selectedId, setSelectedId] = useState(initialChoice?.id || "");
  const [formatKey, setFormatKey] = useState(
    query.get("format") ||
      (initialChoice?.preview ? "medium" : initialChoice?.formats[0]?.key),
  );
  const [photo, setPhoto] = useState(null);
  const [placement, setPlacement] = useState(initialPlacement);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [error, setError] = useState("");
  const stage = useRef(null);
  const upload = useRef(null);
  const photoUrl = useRef(null);
  const generation = useRef(0);
  const gesture = useRef(null);
  const choice = choices.find((item) => item.id === selectedId) || choices[0];
  const format =
    choice?.formats.find((item) => item.key === formatKey) ||
    choice?.formats[0];
  const photoRatio = photo ? photo.width / photo.height : 4 / 3;
  const ratio = format?.width
    ? format.width / format.height
    : (choice?.work.pixelsWidth || 1122) / (choice?.work.pixelsHeight || 1402);
  const rect = artworkRect(placement, photoRatio, ratio);
  const limits = sizeLimits(photoRatio, ratio);

  useEffect(
    () => () => {
      generation.current++;
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    },
    [],
  );
  useEffect(() => {
    gesture.current = null;
    setPlacement((current) => constrainPlacement(current, photoRatio, ratio));
  }, [photoRatio, ratio]);
  useEffect(() => setArtReady(false), [choice?.work.image]);

  async function importPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.type,
      )
    ) {
      setError("Choisissez une photo JPG, PNG, WebP ou AVIF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(
        "Cette photo dépasse 20 Mo. Choisissez une version plus légère.",
      );
      return;
    }
    const request = ++generation.current;
    const source = URL.createObjectURL(file);
    setLoading(true);
    try {
      const image = await readImage(source);
      if (image.naturalWidth * image.naturalHeight > 50_000_000)
        throw new Error(
          "Cette photo est trop grande. Choisissez une version de moins de 50 mégapixels.",
        );
      const scale = Math.min(
        1,
        2560 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("La photo n’a pas pu être préparée. Réessayez.");
      ctx.fillStyle = "#f3eee4";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await imageBlob(canvas);
      if (generation.current !== request) return;
      const nextUrl = URL.createObjectURL(blob);
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
      photoUrl.current = nextUrl;
      setPhoto({ url: nextUrl, width: canvas.width, height: canvas.height });
      setPlacement(initialPlacement);
      gesture.current = null;
    } catch (err) {
      if (generation.current === request)
        setError(
          err instanceof DOMException
            ? "Cette photo ne peut pas être ouverte. Essayez une autre image JPG, PNG ou WebP."
            : err.message,
        );
    } finally {
      URL.revokeObjectURL(source);
      if (generation.current === request) setLoading(false);
    }
  }

  function removePhoto() {
    generation.current++;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    gesture.current = null;
    setPhoto(null);
    setLoading(false);
    setError("");
    setPlacement(initialPlacement);
  }
  function selectWork(next) {
    setSelectedId(next.id);
    setFormatKey(next.preview ? "medium" : next.formats[0].key);
    setError("");
    gesture.current = null;
  }
  function selectFormat(next) {
    const factor =
      format.width && next.width
        ? next.width / format.width
        : (next.scale || 1) / (format.scale || 1);
    const nextRatio = next.width ? next.width / next.height : ratio;
    setFormatKey(next.key);
    setPlacement((current) =>
      constrainPlacement(
        { ...current, width: current.width * factor },
        photoRatio,
        nextRatio,
      ),
    );
    gesture.current = null;
  }
  function changeWidth(width) {
    setPlacement((current) =>
      constrainPlacement({ ...current, width }, photoRatio, ratio),
    );
  }
  function pointerDown(event) {
    if (!photo || gesture.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      id: event.pointerId,
      mode: event.target.closest(".room-resize-handle") ? "resize" : "move",
      clientX: event.clientX,
      clientY: event.clientY,
      box: stage.current.getBoundingClientRect(),
      placement: { ...rect },
    };
  }
  function pointerMove(event) {
    const active = gesture.current;
    if (!active || event.pointerId !== active.id) return;
    const dx = event.clientX - active.clientX,
      dy = event.clientY - active.clientY;
    const next =
      active.mode === "move"
        ? {
            ...active.placement,
            x: active.placement.x + dx / active.box.width,
            y: active.placement.y + dy / active.box.height,
          }
        : {
            ...active.placement,
            width:
              active.placement.width +
              (2 * (dx + dy / ratio)) /
                ((1 + 1 / ratio ** 2) * active.box.width),
          };
    setPlacement(constrainPlacement(next, photoRatio, ratio));
  }
  function pointerEnd(event) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function moveByKey(event) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    if (event.target.closest(".room-resize-handle"))
      changeWidth(
        rect.width +
          (event.key === "ArrowRight" || event.key === "ArrowUp"
            ? step
            : -step),
      );
    else
      setPlacement((current) =>
        constrainPlacement(
          {
            ...current,
            x: rect.x + direction[0] * step,
            y: rect.y + direction[1] * step,
          },
          photoRatio,
          ratio,
        ),
      );
  }

  async function savePreview() {
    if (!photo || !choice || exporting) return;
    const request = generation.current;
    setExporting(true);
    setError("");
    try {
      const [interior, artwork] = await Promise.all([
        readImage(photo.url),
        readImage(roomImage(choice.work)),
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = photo.width;
      canvas.height = photo.height;
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("L’aperçu n’a pas pu être enregistré. Réessayez.");
      ctx.drawImage(interior, 0, 0);
      const x = rect.left * canvas.width,
        y = rect.top * canvas.height;
      const width = rect.width * canvas.width,
        height = rect.height * canvas.height;
      ctx.shadowColor = "rgba(0,0,0,0.24)";
      ctx.shadowBlur = canvas.width * 0.009;
      ctx.shadowOffsetX = canvas.width * 0.002;
      ctx.shadowOffsetY = canvas.width * 0.005;
      ctx.fillStyle = "#f3eee4";
      ctx.fillRect(x, y, width, height);
      ctx.shadowColor = "transparent";
      const imageRatio = artwork.naturalWidth / artwork.naturalHeight;
      const imageWidth = Math.min(width, height * imageRatio),
        imageHeight = imageWidth / imageRatio;
      ctx.drawImage(
        artwork,
        x + (width - imageWidth) / 2,
        y + (height - imageHeight) / 2,
        imageWidth,
        imageHeight,
      );
      const blob = await imageBlob(canvas);
      if (generation.current !== request) return;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "sirius-chez-moi.jpg";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch {
      if (generation.current === request)
        setError("L’aperçu n’a pas pu être enregistré. Réessayez.");
    } finally {
      if (generation.current === request) setExporting(false);
    }
  }

  return (
    <section className="room-page page-width">
      <div className="room-intro">
        <div>
          <p className="eyebrow">Un dialogue avec votre intérieur</p>
          <h1>
            Une œuvre,
            <br />
            <em>chez vous.</em>
          </h1>
        </div>
        <p>
          Une photo de votre pièce, une composition qui vous parle. Prenez le
          temps de trouver sa place.
        </p>
      </div>
      {!choices.length ? (
        <div className="empty-state">
          <h2>La sélection se prépare.</h2>
          <p>Aucune œuvre disponible ne peut être essayée pour le moment.</p>
          <a href="/originaux" data-nav className="text-link">
            Explorer les originaux <Icon />
          </a>
        </div>
      ) : (
        <>
          <input
            ref={upload}
            className="room-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={importPhoto}
            aria-label="Importer une photo de mon intérieur"
            tabIndex="-1"
          />
          <div className="room-layout">
            <div className="room-workspace">
              <div className="room-workspace-heading">
                <span className="eyebrow">01 · Votre intérieur</span>
                {photo && (
                  <div className="room-photo-actions">
                    <button
                      disabled={loading || exporting}
                      onClick={() => upload.current.click()}
                    >
                      Changer la photo
                    </button>
                    <button disabled={exporting} onClick={removePhoto}>
                      Retirer
                    </button>
                  </div>
                )}
              </div>
              <div
                className={`room-canvas ${photo ? "has-photo" : ""}`}
                aria-busy={loading}
              >
                {photo ? (
                  <div
                    className="room-stage"
                    ref={stage}
                    style={{
                      aspectRatio: `${photo.width} / ${photo.height}`,
                      maxWidth: `${640 * photoRatio}px`,
                    }}
                  >
                    <img
                      className="room-photo"
                      src={photo.url}
                      alt="Votre intérieur, support de la visualisation"
                      draggable="false"
                    />
                    <div
                      className="room-artwork"
                      role="group"
                      tabIndex="0"
                      aria-label={`Déplacer ${choice.title} avec les flèches du clavier`}
                      aria-describedby="room-move-help"
                      style={{
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                      }}
                      onPointerDown={pointerDown}
                      onPointerMove={pointerMove}
                      onPointerUp={pointerEnd}
                      onPointerCancel={pointerEnd}
                      onLostPointerCapture={() => {
                        gesture.current = null;
                      }}
                      onKeyDown={moveByKey}
                    >
                      <img
                        src={roomImage(choice.work)}
                        alt={choice.work.alt}
                        draggable="false"
                        onLoad={() => setArtReady(true)}
                        onError={() => {
                          setArtReady(false);
                          setError(
                            "La vue de cette œuvre n’est pas disponible. Choisissez une autre œuvre.",
                          );
                        }}
                      />
                      <button
                        type="button"
                        className="room-resize-handle"
                        aria-label="Agrandir l’œuvre, ou glisser pour ajuster sa taille"
                        onClick={() => changeWidth(rect.width + 0.02)}
                      >
                        <span />
                        <span />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="room-empty">
                    <svg
                      viewBox="0 0 80 66"
                      width="80"
                      height="66"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      aria-hidden="true"
                    >
                      <path d="M4 4h72v43H4zM10 61h60M15 47v14m50-14v14M29 14h22v25H29zM7 51h66" />
                      <path d="M33 32c8-12 11 5 14-10" />
                    </svg>
                    <h2>
                      Et si elle trouvait
                      <br />
                      <em>sa place ici ?</em>
                    </h2>
                    <p>
                      Photographiez votre mur de face,
                      <br />
                      puis importez la photo de votre pièce.
                    </p>
                    <button
                      className="button"
                      onClick={() => upload.current.click()}
                      disabled={loading}
                    >
                      {loading
                        ? "Préparation de la photo…"
                        : "Importer une photo"}
                      <Icon name="plus" />
                    </button>
                    <span className="room-file-note">
                      JPG, PNG, WebP ou AVIF · 20 Mo maximum
                    </span>
                  </div>
                )}
              </div>
              {error && (
                <p className="room-error" role="alert">
                  {error}
                </p>
              )}
              {photo && (
                <p className="room-gesture-help" id="room-move-help">
                  Glissez l’œuvre sur le mur. Tirez son coin pour ajuster la
                  taille, ou utilisez le curseur ci-dessous.
                </p>
              )}
              <div className="room-size-panel">
                <div className="room-size-label">
                  <label htmlFor="room-size">Taille dans la photo</label>
                  <output htmlFor="room-size" aria-live="off">
                    {Math.round(rect.width * 100)} %
                  </output>
                </div>
                <div className="room-size-row">
                  <button
                    className="icon-button"
                    aria-label="Réduire l’œuvre"
                    disabled={!photo || rect.width <= limits.min + 0.001}
                    onClick={() => changeWidth(rect.width - 0.025)}
                  >
                    <Icon name="minus" />
                  </button>
                  <input
                    id="room-size"
                    type="range"
                    min={limits.min * 100}
                    max={limits.max * 100}
                    step="any"
                    value={rect.width * 100}
                    disabled={!photo}
                    onChange={(event) =>
                      changeWidth(Number(event.target.value) / 100)
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label="Agrandir l’œuvre"
                    disabled={!photo || rect.width >= limits.max - 0.001}
                    onClick={() => changeWidth(rect.width + 0.025)}
                  >
                    <Icon name="plus" />
                  </button>
                  <button
                    className="room-reset"
                    disabled={!photo}
                    onClick={() =>
                      setPlacement((current) =>
                        constrainPlacement(
                          { ...current, x: 0.5, y: 0.4 },
                          photoRatio,
                          ratio,
                        ),
                      )
                    }
                  >
                    Recentrer
                  </button>
                </div>
              </div>
              <p className="room-private-note">
                <Icon name="check" />
                Votre photo reste sur votre appareil.
              </p>
            </div>
            <div className="room-options">
              <fieldset className="room-work-picker">
                <legend className="eyebrow">02 · Choisir une œuvre</legend>
                <div className="room-work-list">
                  {choices.map((item) => (
                    <button
                      key={item.id}
                      className={`room-work-option ${choice.id === item.id ? "selected" : ""}`}
                      aria-label={`Choisir ${item.title}, ${item.kind.toLowerCase()}`}
                      aria-pressed={choice.id === item.id}
                      onClick={() => selectWork(item)}
                      disabled={exporting}
                    >
                      <ArtImage work={item.work} sizes="120px" />
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
                <p className="room-selected-title">
                  {choice.title}
                  <span>{choice.kind}</span>
                </p>
              </fieldset>
              <fieldset className="room-formats">
                <legend className="eyebrow">03 · Trouver le format</legend>
                <div>
                  {choice.formats.map((item) => (
                    <button
                      key={item.key}
                      aria-pressed={format.key === item.key}
                      className={format.key === item.key ? "selected" : ""}
                      onClick={() => selectFormat(item)}
                      disabled={exporting}
                    >
                      <span>{item.label}</span>
                      {item.width && (
                        <small>
                          {item.width} × {item.height} cm
                        </small>
                      )}
                    </button>
                  ))}
                </div>
                <p>
                  {choice.preview
                    ? "Trois tailles d’aperçu pour comparer leur présence dans votre pièce."
                    : "Les formats proposés correspondent aux dimensions disponibles de cette œuvre."}
                </p>
              </fieldset>
              <div className="room-result-actions">
                <button
                  className="button full"
                  disabled={!photo || !artReady || exporting || loading}
                  onClick={savePreview}
                >
                  {exporting ? "Enregistrement…" : "Enregistrer l’aperçu"}
                  <Icon name="arrow" />
                </button>
                <a href={choice.href} data-nav className="text-link">
                  Voir la fiche de l’œuvre <Icon />
                </a>
              </div>
              <p className="room-scale-note">
                L’échelle est indicative : ajustez la taille à votre pièce. La
                vue de face permet de mieux apprécier les proportions.
              </p>
            </div>
          </div>
          <p className="room-loading" role="status">
            {loading && photo ? "Préparation de la nouvelle photo…" : ""}
          </p>
        </>
      )}
    </section>
  );
}
