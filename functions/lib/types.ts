export interface Env {
    LNAPAGES_DB: D1Database;
    LNAPAGES_GALLERY: R2Bucket;
    R2_SHOP?: R2Bucket;
    LNAPAGES_MEDIA?: R2Bucket;
    LNAPAGES_CONFIG: KVNamespace;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PUBLISHABLE_KEY: string;
    GITHUB_OAUTH_CLIENT_ID: string;
    GITHUB_OAUTH_CLIENT_SECRET: string;
    GITHUB_REPO_OWNER: string;
    RESEND_API_KEY: string;
    RESEND_FROM_EMAIL: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_FROM_NUMBER: string;
    APP_URL: string;
    R2_PUBLIC_BASE_URL: string;
    GOOGLE_DRIVE_API_KEY?: string;
    SESSION_SECRET: string;
    ADMIN_TOKEN: string;
}

export type R2PresignResult =
    | string
  | URL
  | {
          url: string | URL;
  };

export type PresignableR2Bucket = R2Bucket & {
    createPresignedUrl: (input: { method: 'PUT' | 'GET'; key: string; expiresIn: number }) => Promise<R2PresignResult>;
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
