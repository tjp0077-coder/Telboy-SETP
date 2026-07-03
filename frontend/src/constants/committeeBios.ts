export type CommitteeSeedBio = {
  id: string;
  name: string;
  imageSource: number;
};

export const COMMITTEE_SEED_BIOS: CommitteeSeedBio[] = [
  {
    id: "david-mackay",
    name: "David Mackay",
    imageSource: require("@/assets/images/committee-bios/dave_mackay.jpg"),
  },
  {
    id: "laurie-balderas",
    name: "Laurie Balderas",
    imageSource: require("@/assets/images/committee-bios/lauri_balderas.jpg"),
  },
  {
    id: "tim-below",
    name: "Tim Below",
    imageSource: require("@/assets/images/committee-bios/tim_below.jpg"),
  },
  {
    id: "clark-childers",
    name: "Clark Childers",
    imageSource: require("@/assets/images/committee-bios/clark-childers.jpg"),
  },
  {
    id: "geoff-connolly",
    name: "Geoff Connolly",
    imageSource: require("@/assets/images/committee-bios/goeff-connolly.jpg"),
  },
  {
    id: "paul-edwards",
    name: "Paul Edwards",
    imageSource: require("@/assets/images/committee-bios/paul_edwards.jpg"),
  },
  {
    id: "terry-parker",
    name: "Terry Parker",
    imageSource: require("@/assets/images/committee-bios/terry-parker.jpg"),
  },
  {
    id: "rhys-williams",
    name: "Rhys Williams",
    imageSource: require("@/assets/images/committee-bios/rhys-williams.jpg"),
  },
];

export const COMMITTEE_SEED_BY_ID: Record<string, CommitteeSeedBio> = COMMITTEE_SEED_BIOS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {} as Record<string, CommitteeSeedBio>);

// 26 July display order requirement: Dave + Laurie at top, then remaining team order.
export const COMMITTEE_DAY26_ORDER: string[] = [
  "david-mackay",
  "laurie-balderas",
  "tim-below",
  "clark-childers",
  "geoff-connolly",
  "paul-edwards",
  "terry-parker",
  "rhys-williams",
];
