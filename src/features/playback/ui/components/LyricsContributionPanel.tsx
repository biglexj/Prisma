import { useEffect, useState } from "react";
import { buildContribution, getContribution, submitContribution } from "../../services/publicLyricsClient";
import { loadContributions, prepareContribution, saveContribution, type SavedContribution } from "../../services/lyricsContributions";
import { useAuthSession } from "../../../auth";

const statuses = {
  pending: "Recibido para revisión",
  publishing: "Publicación en proceso",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export function LyricsContributionPanel({
  title,
  artist,
  album,
  text,
  duration,
  signal,
}: {
  title: string;
  artist: string;
  album?: string;
  text: string;
  duration: number;
  signal: AbortSignal;
}) {
  const { session, isAuthenticated, getAccessToken } = useAuthSession();
  const [label, setLabel] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [items, setItems] = useState(loadContributions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setConfirmed(false);
  }, [title, artist, text, label, duration]);

  const execute = async (item: SavedContribution, refresh = false) => {
    setBusy(true);
    setMessage("");
    try {
      const token = isAuthenticated ? await getAccessToken().catch(() => null) : null;
      const receipt =
        refresh && item.receipt
          ? { ...item.receipt, ...(await getContribution(item.receipt, signal)) }
          : await submitContribution(item.body, item.key, signal, token);
      saveContribution({ ...item, receipt });
      if (!signal.aborted) {
        setItems(loadContributions());
        setMessage(statuses[receipt.status]);
      }
    } catch (error) {
      if (!signal.aborted) {
        setMessage(error instanceof Error ? error.message : "No se pudo enviar el aporte.");
      }
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };

  const contribute = () => {
    try {
      const body = buildContribution(title, artist, album, text, label, duration);
      const item = prepareContribution(body);
      setItems(loadContributions());
      void execute(item, Boolean(item.receipt));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el aporte.");
    }
  };

  const authorName = session.displayName || session.email?.split("@")[0] || "mi usuario";

  return (
    <details className="lyrics-online-contribute">
      <summary>Aportar esta letra a Biglex J</summary>
      <p>
        Se enviarán el texto actual del editor, título, artista, álbum y, si hay tiempos, versión y duración.{" "}
        {isAuthenticated
          ? `Tu aporte se registrará con autoría pública de tu cuenta (${authorName}) tras su revisión.`
          : "El aporte es anónimo y se revisará antes de publicarlo. Puedes iniciar sesión en Ajustes para asociar tu autoría."}
      </p>
      <label>
        Versión de la grabación (para letras sincronizadas)
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Por ejemplo: estudio o concierto de Lima"
        />
      </label>
      <label className="lyrics-online-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        He revisado la letra y quiero enviarla para su revisión.
      </label>
      <button
        type="button"
        className="lyrics-sync-btn"
        disabled={!confirmed || busy}
        onClick={contribute}
      >
        {busy
          ? "Enviando aporte..."
          : isAuthenticated
          ? `Enviar aporte como ${authorName}`
          : "Enviar aporte anónimo"}
      </button>
      <p role="status">{message}</p>
      {items.length > 0 && (
        <details>
          <summary>Mis aportes guardados en este equipo ({items.length})</summary>
          {items.map((item) => (
            <div key={item.key} className="lyrics-online-receipt">
              <span>
                {item.body.artist} — {item.body.title}:{" "}
                {item.receipt ? statuses[item.receipt.status] : "Envío sin confirmar"}
              </span>
              <button
                type="button"
                className="lyrics-sync-btn"
                disabled={busy}
                onClick={() => void execute(item, Boolean(item.receipt))}
              >
                {item.receipt ? "Consultar estado" : "Reintentar el mismo aporte"}
              </button>
              {item.receipt?.status === "approved" && item.receipt.lyricId && (
                <span>Disponible en el catálogo; vuelve a buscar el título para consultarlo.</span>
              )}
            </div>
          ))}
        </details>
      )}
    </details>
  );
}
