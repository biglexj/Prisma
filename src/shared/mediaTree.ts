export const FAVORITES_FOLDER_ID = "prisma://favorites";
export const ALL_MEDIA_FOLDER_ID = "prisma://all";

export interface HierarchicalFolder<T> {
  id: string; // Full relative path or virtual ID
  displayName: string; // Display name
  parentPath: string;
  isVirtual?: boolean;
  virtualType?: "favorites" | "all";
  directItems: T[];
  allRecursiveItems: T[];
}

export interface TreeNavigationLevel<T> {
  currentPath: string; // "" for root
  currentDisplayName: string;
  isVirtual: boolean;
  virtualType?: "favorites" | "all";
  subfolders: HierarchicalFolder<T>[];
  directItems: T[];
  allRecursiveItems: T[];
}

export function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/$/, "");
}

export function getCleanRelativeFolder(relativeFolder: string | null | undefined): string {
  if (!relativeFolder) return "Carpeta principal";
  const norm = normalizePathSeparators(relativeFolder);
  if (norm === "." || norm === "/" || norm === "") return "Carpeta principal";
  return norm.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Resuelve la vista de carpetas de Prisma.
 * En la raíz presenta todas las carpetas reconocidas de la biblioteca,
 * precedidas por las carpetas virtuales Favoritos y Todas.
 */
export function resolveTreeLevel<T extends { path: string; relativeFolder?: string }>(
  items: T[],
  currentPath: string,
  favoritePaths: Set<string>,
  libraryLabel: { allName: string; mediaType: "music" | "image" | "video" },
): TreeNavigationLevel<T> {
  const normCurrent = normalizePathSeparators(currentPath).replace(/^\/+/, "").replace(/\/+$/, "");

  // Caso 1: Carpeta virtual de Favoritos
  if (normCurrent === FAVORITES_FOLDER_ID) {
    const favItems = items.filter((it) => favoritePaths.has(it.path));
    return {
      currentPath: FAVORITES_FOLDER_ID,
      currentDisplayName: "Favoritos",
      isVirtual: true,
      virtualType: "favorites",
      subfolders: [],
      directItems: favItems,
      allRecursiveItems: favItems,
    };
  }

  // Caso 2: Carpeta virtual de Todos los archivos
  if (normCurrent === ALL_MEDIA_FOLDER_ID) {
    return {
      currentPath: ALL_MEDIA_FOLDER_ID,
      currentDisplayName: libraryLabel.allName,
      isVirtual: true,
      virtualType: "all",
      subfolders: [],
      directItems: items,
      allRecursiveItems: items,
    };
  }

  // Caso 3: Vista interna de una carpeta física seleccionada
  if (normCurrent !== "") {
    const folderItems = items.filter((it) => {
      const folder = getCleanRelativeFolder(it.relativeFolder);
      return folder === normCurrent || folder.startsWith(`${normCurrent}/`);
    });

    const currentDisplayName = normCurrent.split("/").pop() || normCurrent;

    return {
      currentPath: normCurrent,
      currentDisplayName,
      isVirtual: false,
      subfolders: [],
      directItems: folderItems,
      allRecursiveItems: folderItems,
    };
  }

  // Caso 4: Raíz ("") -> Mostrar TODAS las carpetas de la biblioteca
  const foldersMap = new Map<string, T[]>();

  for (const item of items) {
    const folder = getCleanRelativeFolder(item.relativeFolder);
    const existing = foldersMap.get(folder);
    if (existing) {
      existing.push(item);
    } else {
      foldersMap.set(folder, [item]);
    }
  }

  const subfolders: HierarchicalFolder<T>[] = [];

  // 1. Tarjeta virtual Favoritos
  const favItems = items.filter((it) => favoritePaths.has(it.path));
  subfolders.push({
    id: FAVORITES_FOLDER_ID,
    displayName: "Favoritos",
    parentPath: "",
    isVirtual: true,
    virtualType: "favorites",
    directItems: favItems,
    allRecursiveItems: favItems,
  });

  // 2. Tarjeta virtual Todas
  subfolders.push({
    id: ALL_MEDIA_FOLDER_ID,
    displayName: libraryLabel.allName,
    parentPath: "",
    isVirtual: true,
    virtualType: "all",
    directItems: items,
    allRecursiveItems: items,
  });

  // 3. Todas las carpetas físicas de la biblioteca
  const sortedFolders = Array.from(foldersMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  for (const [folderPath, folderItems] of sortedFolders) {
    subfolders.push({
      id: folderPath,
      displayName: folderPath,
      parentPath: "",
      isVirtual: false,
      directItems: folderItems,
      allRecursiveItems: folderItems,
    });
  }

  return {
    currentPath: "",
    currentDisplayName: "Biblioteca",
    isVirtual: false,
    subfolders,
    directItems: [],
    allRecursiveItems: items,
  };
}
