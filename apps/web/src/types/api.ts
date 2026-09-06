export interface ApiResponse<T> {
  status: 'success';
  data: T;
  meta?: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface ApiError {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

/**
 * Mirrors UserResponse in the API's OpenAPI schema.
 *
 * There is no `name` field and never was: the API sends a required `username`
 * handle plus a nullable free-text `display_name`. The previous declaration
 * here claimed `name: string`, so `user.name.charAt(0)` in the top bar threw
 * "Cannot read properties of undefined" the moment a session existed. It went
 * unnoticed only because registration was itself broken, which made an
 * authenticated session nearly impossible to obtain.
 *
 * Use `displayLabel(user)` below rather than reaching for a name directly.
 */
export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role: string;
  created_at: string;
  updated_at?: string;
}

/** What to show for a user: their chosen display name, else their handle. */
export function displayLabel(user: Pick<User, 'username' | 'display_name'>): string {
  return user.display_name?.trim() || user.username;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  mission_count: number;
}

export interface Mission {
  id: string;
  project_id: string;
  name: string;
  objective: string;
  status: 'draft' | 'ready' | 'simulated' | 'analyzed';
  target_altitude_km: number;
  target_type: 'suborbital' | 'leo' | 'meo' | 'geo' | 'escape';
  created_at: string;
  updated_at: string;
}

/**
 * A photograph attached to a catalogue record.
 *
 * The API declares this field as an untyped passthrough (`list[Any]`), so the
 * shape that actually arrives is whatever the catalogue stored — which is
 * `data/catalog/models.py::ImageRef`. Everything past `url` is optional here
 * because a record ingested from a source other than the bundled catalogue may
 * legitimately carry less.
 *
 * `credit` matters: NASA, ESA and ISRO imagery is public domain or openly
 * licensed, but a named photographer or contributing institution is still owed
 * an attribution wherever the picture is shown.
 */
export interface SpaceObjectImage {
  url: string;
  alt?: string;
  title?: string;
  credit?: string;
  /** Instrument or mission that took it, where known. */
  instrument?: string;
  /** ISO-8601 capture date, where known. */
  date?: string;
}

/**
 * Mirrors SpaceObjectSummary / SpaceObjectDetail in the API's OpenAPI schema.
 *
 * The previous shape here was hand-written and had drifted from every field the
 * API actually sends: `object_type` for `category`, a single `image_url` for the
 * `images[]` array, `source_name` for `source`, and
 * `physical_properties`/`orbital_elements` for `physical_data`/`orbital_data`.
 * Because every one of those reads was optional chaining on an absent key, the
 * drift failed silently - Explore rendered empty type badges and no imagery at
 * all rather than raising anything.
 *
 * Fields below the marker are returned only by the detail endpoint.
 */
export interface SpaceObject {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  description?: string | null;
  images: SpaceObjectImage[];
  source?: string | null;

  // -- detail endpoint only -------------------------------------------------
  physical_data?: Record<string, unknown> | null;
  orbital_data?: Record<string, unknown> | null;
  discovery?: Record<string, unknown> | null;
  source_id?: string | null;
  last_updated?: string | null;
  created_at?: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  content?: string;
  image_url?: string;
  completed?: boolean;
  progress?: number;
}

export interface LessonCategory {
  id: string;
  name: string;
  description: string;
  lesson_count: number;
  icon?: string;
}
