/*
 * V5 nav layer barrel.
 *
 * Why: single import surface for navigation primitives. Wave 8 (V5-M3)
 *      seeds Tabs (D.3.3, 3 variants); subsequent waves add Breadcrumb /
 *      Pagination / SidebarRail / TopBar.
 */
export { Tabs } from './Tabs';
export type { TabsProps, TabsVariant, TabsSize, TabItem } from './Tabs';
