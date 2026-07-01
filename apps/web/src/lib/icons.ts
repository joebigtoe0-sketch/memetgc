/** UI icons from /public/icons */
export const ICONS = {
  battle: "/icons/battle.png",
  collection: "/icons/collection.png",
  fragment: "/icons/fragment.png",
  pack: "/icons/pack.png",
  profile: "/icons/profile.png",
  shop: "/icons/shop.png",
} as const;

export type IconName = keyof typeof ICONS;
