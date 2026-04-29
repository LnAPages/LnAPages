# LnAPages booking + admin scaffold

Production-ready scaffold built with Vite + React + Cloudflare Pages Functions + D1 + R2 + KV.

## Prerequisites
- Node.js 20 (`.nvmrc` included)
- - npm
  - - Wrangler CLI (installed via devDependencies)
    - - Stripe CLI (for local webhook forwarding)
     
      - ## Install
      - ```bash
        npm install
        ```

        ## Cloudflare resource setup
        ```bash
        wrangler d1 create lnapages
        wrangler r2 bucket create lnapages-gallery
        wrangler kv namespace create lnapages-config
        ```

        Update `wrangler.toml` with the real D1 `database_id` and KV `id`.

        ## Environment setup

        Copy `.env.example` to `.env` and fill all values:
        - `STRIPE_SECRET_KEY`
        - - `STRIPE_WEBHOOK_SECRET`
          - - `VITE_STRIPE_PUBLISHABLE_KEY` (**build-time plaintext var** for Vite client inlining, not a secret binding)
            - - `GITHUB_OAUTH_CLIENT_ID`
              - - `GITHUB_OAUTH_CLIENT_SECRET`
                - - `GITHUB_REPO_OWNER` (set to `LnAPages`)
                  - - `RESEND_API_KEY`
                    - - `RESEND_FROM_EMAIL`
                      - - `TWILIO_ACCOUNT_SID`
                        - - `TWILIO_AUTH_TOKEN`
                          - - `TWILIO_FROM_NUMBER`
                            - - `APP_URL`
                              - - `R2_PUBLIC_BASE_URL`
                                - - `GOOGLE_DRIVE_API_KEY` (optional; runtime plaintext env var for faster Drive folder indexing)
                                 
                                  - **Cloudflare Pages reminder:**
                                  - Set `GOOGLE_DRIVE_API_KEY` as a runtime plaintext Environment Variable if you use Drive mode.
                                  - Keep `VITE_STRIPE_PUBLISHABLE_KEY` as a build-time plaintext Environment Variable (not a secret binding), so Vite can inline it into the client bundle.
                                  - For Cloudflare Pages runtime, set both `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as secret bindings.
                                  - A build-time `VITE_STRIPE_PUBLISHABLE_KEY` is no longer required.
                                 
                                  - ## Database migrations
                                 
                                  - Local:
                                  - ```bash
                                    wrangler d1 migrations apply lnapages --local
                                    ```

                                    Remote:
                                    ```bash
                                    wrangler d1 migrations apply lnapages --remote
                                    ```

                                    Seed local data:
                                    ```bash
                                    npm run db:seed
                                    ```

                                    ## Local development

                                    ```bash
                                    npm run dev
                                    ```

                                    `npm run dev` runs Vite + wrangler pages dev together.

                                    ## Stripe webhook local setup

                                    Forward Stripe events locally:
                                    ```bash
                                    stripe listen --forward-to http://127.0.0.1:8788/api/payments/webhook
                                    ```
                                    Copy webhook secret into `STRIPE_WEBHOOK_SECRET`.

                                    ## Deploy
                                    ```bash
                                    npm run build
                                    npm run deploy
                                    ```

                                    ## Cloudflare Dashboard checklist
                                    - D1 binding: `LNAPAGES_DB`
                                    - - R2 binding: `LNAPAGES_GALLERY`
                                      - - KV binding: `LNAPAGES_CONFIG`
                                        - - Env vars from `.env.example`
                                          - - `nodejs_compat` compatibility flag
                                            - - R2 CORS setup: Configure your R2 bucket CORS to allow PUT and GET from your app domain and localhost during development.
