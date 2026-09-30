/**
 * Canonical Apple iPhone model and color catalog.
 *
 * Names are the values to persist. Hex values are approximate UI swatches only.
 */
export type IPhoneColor = Readonly<{
  name: string;
  hex?: string;
}>;

export type IPhoneCatalogItem = Readonly<{
  id: string;
  name: string;
  year: number;
  order: number;
  colors: readonly IPhoneColor[];
}>;

const COLOR_HEX: Readonly<Record<string, string>> = Object.freeze({
  Gold: "#C9A66B",
  Silver: "#D6D6D2",
  "Space Gray": "#737579",
  "(PRODUCT)RED": "#B50018",
  Black: "#222326",
  White: "#F4F4F1",
  Blue: "#4B79C6",
  Yellow: "#F4D34E",
  Coral: "#FF765E",
  Purple: "#AD91C8",
  Green: "#68A777",
  "Midnight Green": "#45534B",
  Graphite: "#5D5E62",
  "Pacific Blue": "#547E9B",
  Pink: "#E9A7B2",
  Starlight: "#E7DFD0",
  Midnight: "#252B31",
  "Sierra Blue": "#A9BED1",
  "Alpine Green": "#576D60",
  "Space Black": "#383838",
  "Deep Purple": "#55415F",
  Teal: "#6AA9A3",
  Ultramarine: "#4B54B7",
  "Black Titanium": "#333435",
  "White Titanium": "#E6E2DB",
  "Blue Titanium": "#4B6E90",
  "Natural Titanium": "#8F8E88",
  "Desert Titanium": "#BD9B7E",
  "Mist Blue": "#AFC6D2",
  Sage: "#A9B89B",
  Lavender: "#D4C9E3",
  "Cosmic Orange": "#D7662D",
  "Deep Blue": "#173556",
  "Cloud White": "#F2F2EE",
  "Light Gold": "#D9C4A1",
  "Sky Blue": "#A8D4EB",
  "Soft Pink": "#E7B7C4",
  Glacier: "#B8CBDC",
  Burgundy: "#6D2637",
});

function makeColors(names: readonly string[]): readonly IPhoneColor[] {
  return Object.freeze(
    names.map((name) => Object.freeze({ name, hex: COLOR_HEX[name] })),
  );
}

function makeItem(
  id: string,
  name: string,
  year: number,
  order: number,
  colors: readonly IPhoneColor[],
): IPhoneCatalogItem {
  return Object.freeze({ id, name, year, order, colors });
}

// Shared arrays keep identical model-pair color lists defined only once.
const colors = {
  iphone8: makeColors(["Gold", "Silver", "Space Gray", "(PRODUCT)RED"]),
  iphoneX: makeColors(["Silver", "Space Gray"]),
  iphoneXR: makeColors([
    "Black",
    "White",
    "Blue",
    "Yellow",
    "Coral",
    "(PRODUCT)RED",
  ]),
  iphoneXS: makeColors(["Silver", "Space Gray", "Gold"]),
  iphone11: makeColors([
    "Purple",
    "Yellow",
    "Green",
    "Black",
    "White",
    "(PRODUCT)RED",
  ]),
  iphone11Pro: makeColors(["Gold", "Space Gray", "Silver", "Midnight Green"]),
  iphoneSE2: makeColors(["Black", "White", "(PRODUCT)RED"]),
  iphone12: makeColors([
    "Black",
    "White",
    "(PRODUCT)RED",
    "Green",
    "Blue",
    "Purple",
  ]),
  iphone12Pro: makeColors(["Silver", "Graphite", "Gold", "Pacific Blue"]),
  iphone13: makeColors([
    "(PRODUCT)RED",
    "Starlight",
    "Midnight",
    "Blue",
    "Pink",
    "Green",
  ]),
  iphone13Pro: makeColors([
    "Graphite",
    "Gold",
    "Silver",
    "Sierra Blue",
    "Alpine Green",
  ]),
  iphoneSE3: makeColors(["(PRODUCT)RED", "Starlight", "Midnight"]),
  iphone14: makeColors([
    "Midnight",
    "Purple",
    "Starlight",
    "(PRODUCT)RED",
    "Blue",
    "Yellow",
  ]),
  iphone14Pro: makeColors(["Space Black", "Silver", "Gold", "Deep Purple"]),
  iphone15: makeColors(["Black", "Blue", "Green", "Yellow", "Pink"]),
  iphone15Pro: makeColors([
    "Black Titanium",
    "White Titanium",
    "Blue Titanium",
    "Natural Titanium",
  ]),
  iphone16: makeColors(["Black", "White", "Pink", "Teal", "Ultramarine"]),
  iphone16Pro: makeColors([
    "Black Titanium",
    "White Titanium",
    "Natural Titanium",
    "Desert Titanium",
  ]),
  iphone16e: makeColors(["Black", "White"]),
  iphone17: makeColors(["Black", "White", "Mist Blue", "Sage", "Lavender"]),
  iphone17Pro: makeColors(["Silver", "Cosmic Orange", "Deep Blue"]),
  iphoneAir: makeColors(["Space Black", "Cloud White", "Light Gold", "Sky Blue"]),
  iphone17e: makeColors(["Black", "White", "Soft Pink"]),
  iphone18Pro: makeColors(["Black", "Silver", "Glacier", "Burgundy"]),
} as const;

/**
 * Oldest first. `order` is a release sequence, independent of marketing
 * generation labels, so models released in the same year remain sortable.
 */
export const IPHONE_CATALOG: readonly IPhoneCatalogItem[] = Object.freeze([
  makeItem("iphone-8", "iPhone 8", 2017, 1, colors.iphone8),
  makeItem("iphone-8-plus", "iPhone 8 Plus", 2017, 2, colors.iphone8),
  makeItem("iphone-x", "iPhone X", 2017, 3, colors.iphoneX),
  makeItem("iphone-xr", "iPhone XR", 2018, 4, colors.iphoneXR),
  makeItem("iphone-xs", "iPhone XS", 2018, 5, colors.iphoneXS),
  makeItem("iphone-xs-max", "iPhone XS Max", 2018, 6, colors.iphoneXS),
  makeItem("iphone-11", "iPhone 11", 2019, 7, colors.iphone11),
  makeItem("iphone-11-pro", "iPhone 11 Pro", 2019, 8, colors.iphone11Pro),
  makeItem("iphone-11-pro-max", "iPhone 11 Pro Max", 2019, 9, colors.iphone11Pro),
  makeItem("iphone-se-2", "iPhone SE (2nd gen)", 2020, 10, colors.iphoneSE2),
  makeItem("iphone-12-mini", "iPhone 12 mini", 2020, 11, colors.iphone12),
  makeItem("iphone-12", "iPhone 12", 2020, 12, colors.iphone12),
  makeItem("iphone-12-pro", "iPhone 12 Pro", 2020, 13, colors.iphone12Pro),
  makeItem("iphone-12-pro-max", "iPhone 12 Pro Max", 2020, 14, colors.iphone12Pro),
  makeItem("iphone-13-mini", "iPhone 13 mini", 2021, 15, colors.iphone13),
  makeItem("iphone-13", "iPhone 13", 2021, 16, colors.iphone13),
  makeItem("iphone-13-pro", "iPhone 13 Pro", 2021, 17, colors.iphone13Pro),
  makeItem("iphone-13-pro-max", "iPhone 13 Pro Max", 2021, 18, colors.iphone13Pro),
  makeItem("iphone-se-3", "iPhone SE (3rd gen)", 2022, 19, colors.iphoneSE3),
  makeItem("iphone-14", "iPhone 14", 2022, 20, colors.iphone14),
  makeItem("iphone-14-plus", "iPhone 14 Plus", 2022, 21, colors.iphone14),
  makeItem("iphone-14-pro", "iPhone 14 Pro", 2022, 22, colors.iphone14Pro),
  makeItem("iphone-14-pro-max", "iPhone 14 Pro Max", 2022, 23, colors.iphone14Pro),
  makeItem("iphone-15", "iPhone 15", 2023, 24, colors.iphone15),
  makeItem("iphone-15-plus", "iPhone 15 Plus", 2023, 25, colors.iphone15),
  makeItem("iphone-15-pro", "iPhone 15 Pro", 2023, 26, colors.iphone15Pro),
  makeItem("iphone-15-pro-max", "iPhone 15 Pro Max", 2023, 27, colors.iphone15Pro),
  makeItem("iphone-16", "iPhone 16", 2024, 28, colors.iphone16),
  makeItem("iphone-16-plus", "iPhone 16 Plus", 2024, 29, colors.iphone16),
  makeItem("iphone-16-pro", "iPhone 16 Pro", 2024, 30, colors.iphone16Pro),
  makeItem("iphone-16-pro-max", "iPhone 16 Pro Max", 2024, 31, colors.iphone16Pro),
  makeItem("iphone-16e", "iPhone 16e", 2025, 32, colors.iphone16e),
  makeItem("iphone-17", "iPhone 17", 2025, 33, colors.iphone17),
  makeItem("iphone-17-pro", "iPhone 17 Pro", 2025, 34, colors.iphone17Pro),
  makeItem("iphone-17-pro-max", "iPhone 17 Pro Max", 2025, 35, colors.iphone17Pro),
  makeItem("iphone-air", "iPhone Air", 2025, 36, colors.iphoneAir),
  makeItem("iphone-17e", "iPhone 17e", 2026, 37, colors.iphone17e),
  makeItem("iphone-18-pro", "iPhone 18 Pro", 2026, 38, colors.iphone18Pro),
  makeItem("iphone-18-pro-max", "iPhone 18 Pro Max", 2026, 39, colors.iphone18Pro),
]);

const EMPTY_COLORS: readonly IPhoneColor[] = Object.freeze([]);

export function getIPhoneById(id: string): IPhoneCatalogItem | undefined {
  return IPHONE_CATALOG.find((item) => item.id === id);
}

export function getIPhoneColors(id: string): readonly IPhoneColor[] {
  return getIPhoneById(id)?.colors ?? EMPTY_COLORS;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isSubsequence(query: string, value: string): boolean {
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return queryIndex === query.length;
}

/** Search names with compact substring or character-subsequence matching. */
export function searchIPhones(query: string): IPhoneCatalogItem[] {
  const normalizedQuery = normalize(query);
  return IPHONE_CATALOG.filter((item) => {
    if (!normalizedQuery) return true;
    const normalizedName = normalize(item.name);
    return (
      normalizedName.includes(normalizedQuery) ||
      isSubsequence(normalizedQuery, normalizedName)
    );
  }).sort((a, b) => b.order - a.order);
}

export function isValidIPhoneModel(id: string): boolean {
  return getIPhoneById(id) !== undefined;
}

export function isValidIPhoneColor(id: string, colorName: string): boolean {
  return getIPhoneColors(id).some((color) => color.name === colorName);
}
