# Forge GitHub App onboarding

## Flows that must remain distinct

- The GitHub App **Setup URL** receives an installation result after an initial installation. With **Redirect on update** enabled, it is also used after repository-selection changes. GitHub supplies `installation_id`; NØLINE accepts only the explicit `setup_action` values `install` and `update` for association.
- A GitHub App **OAuth callback URL** receives a `code` when a user authorizes the app to act on their behalf. Forge does not use that OAuth user-token flow today, so the configured Callback URL does not complete installation onboarding.
- Homepage URL is informational and is not an installation callback.

## Environment-aware callback

The Setup URL is global, so it must point at one stable deployment of this application:

`https://nolinestudio.fr/api/forge/github/callback`

That stable endpoint is a broker, not the final association endpoint:

1. The originating NØLINE environment authenticates the user at `/api/forge/github/install`.
2. It signs a short-lived state containing the user, a random nonce and an exact validated origin. The nonce is also stored in an HTTP-only, same-site cookie on that origin.
3. GitHub returns the signed state, `installation_id` and `setup_action` to the global Setup URL.
4. The broker validates the state, verifies the installation server-side with the GitHub App, requires `repository_selection=selected`, and proves that at least one repository is accessible.
5. The broker returns a short-lived signed completion envelope to the exact signed origin. Arbitrary return URLs are never accepted.
6. The browser finalizes through authenticated `POST /api/forge/github/complete` on the origin. Finalization requires the same NØLINE user and nonce cookie, repeats the server-side installation checks, and then applies the existing installation ownership-conflict protection before association.

This design lets Production and a Vercel Preview share the global Setup URL without sharing browser cookies. A callback cannot associate an arbitrary installation on its own.

## Deployment requirement

The stable Setup URL must serve the same callback implementation before enabling the real flow. Preview deployments may originate and finalize a connection, but the global callback host cannot remain on a different Vercel project that returns 404.

Production and Preview Supabase credentials remain isolated. No installation token or GitHub App private key is sent to the browser or persisted by this flow.
