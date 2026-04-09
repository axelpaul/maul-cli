// ─── User Profile ────────────────────────────────────────────────

export interface UserProfile {
  UserId: string;
  Email: string;
  CompanyName: string;
  LocationId: string;
  Name?: string;
  [key: string]: unknown;
}

// ─── Menu ────────────────────────────────────────────────────────

export interface MenuItemDescription {
  en?: string;
  is?: string;
  [lang: string]: string | undefined;
}

export interface MenuItem {
  MenuItemId: string;
  RestaurantId: string;
  RestaurantName: string;
  WeekdayNumber: number;
  MealTime: string;
  Allergens: string[];
  AllergensProvided: boolean;
  DietTypes: string[];
  DescriptionByLang: MenuItemDescription;
  ShortDescriptionByLang: MenuItemDescription;
  Date: string;
  Temperature: string;
  ImageId: string | null;
  CandidateMenuItemIds: string[];
}

export interface WeeklyMenu {
  IsoWeek: string;
  Menu: MenuItem[];
}

// ─── Orders ──────────────────────────────────────────────────────

export interface OrderItem {
  RestaurantId: string;
  MenuId: string;
  MenuItemId: string;
  MealTime: string;
  OrderDate: string;
}

export interface OrderSubmission {
  UserId: string;
  OrderItems: OrderItem[];
}

export interface ExistingOrderItem {
  MenuItemId: string;
  RestaurantId: string;
  RestaurantName: string;
  WeekdayNumber: number | string;
  MealTime: string;
  Allergens: string[];
  AllergensProvided: boolean;
  DietTypes: string[];
  DescriptionByLang: MenuItemDescription;
  ShortDescriptionByLang: MenuItemDescription;
  Date: string;
}

// ─── Auth / Token Cache ──────────────────────────────────────────

export interface CachedToken {
  accessToken: string;
  userId: string;
  organization: string;
  email: string;
  expiresAt: number; // unix timestamp ms
}

// ─── CLI Output ──────────────────────────────────────────────────

export interface CliError {
  error: string;
  status_code?: number;
}

// ─── Location Orders (Admin) ─────────────────────────────────────

export interface LocationOrder {
  UserId: string;
  Email?: string;
  Name?: string;
  MenuItemId: string;
  RestaurantName: string;
  MealTime: string;
  [key: string]: unknown;
}
