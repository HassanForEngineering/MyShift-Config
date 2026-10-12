# MyShift account-deletion web

Arabic RTL responsive account-deletion page. It reads the public `server.json` from the MyShift-Config `main` branch, validates its fields, bypasses browser cache when checking configuration, respects maintenance mode, and uses `server_url` as the API origin. It never embeds the server tunnel URL in JavaScript.

## Public configuration

`https://raw.githubusercontent.com/HassanForEngineering/MyShift-Config/main/server.json`

Expected fields: `server_url` (HTTPS origin), `maintenance` (boolean), and `maintenance_message` (string). Keep secrets out of this file.

## External deletion flow

The page calls:

- `POST /api/v1/account-deletion/request-otp` with `{ "phone": "+..." }`
- `POST /api/v1/account-deletion/confirm` with `{ "phone": "+...", "challenge_id": "...", "code": "......", "confirmation": "DELETE_MY_ACCOUNT" }`

The API only returns success for deletion after the server completes the deletion/anonymization transaction and returns `deleted: true` and `accountStatus: "DELETED"`. The page checks both fields. Unknown phone numbers receive a generic request response to reduce account enumeration. Phone normalization converts Arabic-Indic decimal digits to ASCII before identity lookup and WhatsApp delivery.

Account deletion is deliberately stopped before any storage/data side effects if the account is still the recorded owner of an organization, is its last active owner, or has active direct reports that have not been reassigned. The user must transfer ownership/reassign direct reports in the organization workflow, then request a fresh OTP and retry. This avoids silently orphaning an organization or leaving active manager references to a deleted membership.

### Required external provider configuration

External deletion is deliberately unavailable until the operator configures Meta WhatsApp Cloud API credentials and an approved Arabic message template. Set these server-side environment variables, never in this public repository:

- `WHATSAPP_CLOUD_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION` (default `v23.0`)
- `WHATSAPP_DELETION_OTP_TEMPLATE` (default `myshift_account_deletion_otp`)

The approved template must contain one body variable for the six-digit OTP. The deployed API CORS allow-list (`CORS_ORIGINS`) must include the exact public HTTPS origin of this page; do not use a wildcard in production. The API limits OTP sends to three per phone and ten per source IP in 15 minutes, gives each code a ten-minute lifetime, hashes codes with the server secret, and allows at most five attempts. Configure Meta and test delivery in a non-production environment before publishing the external flow. Until configured, the endpoint returns an explicit `503` and the page does not claim that an OTP was sent or that deletion occurred.

## Hosting

Use Cloudflare Pages connected to `HassanForEngineering/MyShift-Config`, branch `main`, with project root `account-deletion-web`, no build command, and output directory `.` for plain HTML/CSS/JS. Confirm whether the existing Cloudflare project is Pages or Workers before changing deployment settings. Do not enable Cloudflare Access on this public page. No GitHub push or Cloudflare deployment is performed by this package.

## Data retention

Personal profile and contact fields are cleared, active sessions and device registrations are revoked, pending join requests are cancelled, and memberships are disabled. Organization-owned attendance/request/audit history is retained to avoid damaging employer records; organization-owned files are detached from the deleted personal owner. Personal object-storage files must be safely removed before the deletion transaction can complete. The organization retention policy and legal retention periods must be approved by the operator before public release.
