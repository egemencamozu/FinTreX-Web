export interface NetworkFilterPill {
  id: string;
  label: string;
  icon?: string; // FontAwesome icon class or image URL
  isImage?: boolean; // If true, icon is treated as <img src>, otherwise <i class>
  title?: string;
}
