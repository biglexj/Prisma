export const FAVORITES_FOLDER_ID = "prisma://favorites";
export const ALL_MEDIA_FOLDER_ID = "prisma://all";

export interface HierarchicalFolder<T> {
  id: string; // Full relative path or virtual ID
  displayName: string; // Immediate folder name (e.g. "Ending" instead of "Anime Music/Black Clover/Ending")
  parentPath: string; // Immediate parent path
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

/**
 * Extrae la carpeta relativa limpia a partir de la ruta y carpeta relativa reportada
 */
export function getCleanRelativeFolder(relativeFolder: string | null | undefined): string {
  if (!relativeFolder) return "";
  const norm = normalizePathSeparators(relativeFolder);
  if (norm === "." || norm === "/" || norm === "Carpeta principal") return "";
  return norm.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Construye el nivel actual de navegación en árbol jerárquico.
 * A diferencia de una lista plana, en la raíz solo muestra las carpetas de primer nivel
 * y permite navegar progresivamente hacia subcarpetas con migas de pan.
 */
export function resolveTreeLevel<T extends { path: string; relativeFolder?: string }>(
  items: T[],
  currentPath: string, // "" para raíz, o "Anime Music", o "Anime Music/Black Clover"
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

  // Caso 3: Navegación real en árbol físico
  const subfolderMap = new Map<string, { displayName: string; fullPath: string; recursive: T[] }>();
  const directItems: T[] = [];
  const allRecursiveItems: T[] = [];

  const prefix = normCurrent ? `${normCurrent}/` : "";

  for (const item of items) {
    const itemFolder = getCleanRelativeFolder(item.relativeFolder);

    // ¿Pertenece a la rama actual?
    if (normCurrent === "" || itemFolder === normCurrent || itemFolder.startsWith(prefix)) {
      allRecursiveItems.push(item);

      if (itemFolder === normCurrent) {
        // Archivo directo en este nivel
        directItems.push(item);
      } else if (itemFolder.startsWith(prefix)) {
        // Archivo en una subcarpeta de este nivel
        const remaining = itemFolder.slice(prefix.length);
        const immediateChildName = remaining.split("/")[0];
        const immediateChildFullPath = normCurrent ? `${normCurrent}/${immediateChildName}` : immediateChildName;

        const existing = subfolderMap.get(immediateChildFullPath);
        if (existing) {
          existing.recursive.push(item);
        } else {
          subfolderMap.set(immediateChildFullPath, {
            displayName: immediateChildName,
            fullPath: immediateChildFullPath,
            recursive: [item],
          });
        }
      }
    }
  }

  const subfolders: HierarchicalFolder<T>[] = [];

  // En la raíz, anteponer las carpetas virtuales Favoritos y Todas
  if (normCurrent === "") {
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

    subfolders.push({
      id: ALL_MEDIA_FOLDER_ID,
      displayName: libraryLabel.allName,
      parentPath: "",
      isVirtual: true,
      virtualType: "all",
      directItems: items,
      allRecursiveItems: items,
    });
  }

  // Añadir las subcarpetas físicas ordenadas alfabéticamente
  const sortedPhysical = Array.from(subfolderMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: "base" }),
  );

  for (const group of sortedPhysical) {
    subfolders.push({
      id: group.fullPath,
      displayName: group.displayName,
      parentPath: normCurrent,
      isVirtual: false,
      directItems: [],
      allRecursiveItems: group.recursive,
    });
  }

  const currentDisplayName = normCurrent
    ? normCurrent.split("/").pop() || normCurrent
    : "Biblioteca";

  return {
    currentPath: normCurrent,
    currentDisplayName,
    isVirtual: false,
    subfolders,
    directItems,
    allRecursiveItems,
  };
}
