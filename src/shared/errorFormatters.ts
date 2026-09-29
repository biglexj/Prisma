export function formatFriendlyErrorMessage(raw: string | null | undefined): string {
  if (!raw) return "";
  const error = String(raw);

  if (error.includes("state not managed") || error.includes("manage()")) {
    return "Los servicios internos de Prisma se están inicializando. Sincronizando datos...";
  }
  if (
    error.includes("os error 3") ||
    error.includes("cannot find the path") ||
    error.includes("The system cannot find the path")
  ) {
    return "La unidad o ruta de la carpeta no se encuentra disponible o fue desconectada.";
  }
  if (
    error.includes("os error 5") ||
    error.includes("Access is denied") ||
    error.includes("Acceso denegado")
  ) {
    return "Acceso denegado por el sistema. Comprueba los permisos de lectura sobre la carpeta.";
  }
  if (error.includes("os error 32") || error.includes("being used by another process")) {
    return "El archivo o biblioteca está en uso por otro proceso.";
  }
  if (error.includes("Cannot read property") || error.includes("undefined is not an object")) {
    return "Ocurrió un error inesperado al procesar los elementos.";
  }
  if (error.includes("NetworkError") || error.includes("Failed to fetch")) {
    return "No se pudo conectar con el servicio local.";
  }

  return error;
}
