# EKEEKRTA

The platform name selected by the user is **EKEEKRTA**, in uppercase. The intended spoken form is “ay-kee-kri-ta.” This is an institution-neutral platform brand, not a rename of HITAM or any other institution.

**Tagline:** One platform. Every learning connection.

## Identity

- **Mark:** A compact geometric E. White and mint bars share one spine, suggesting separate learning activities brought together. Use the supplied SVG so the mark stays sharp at small sizes.
- **Wordmark:** EKEEKRTA, IBM Plex Sans, semibold, with modest letter spacing. Do not replace it with SVL or LMS Platform.
- **Institution identity:** The platform wordmark appears in navigation. The institution name, institution logo and role remain separate in the dashboard header. Never overwrite an institution’s saved details with the platform brand.

| Use | Colour |
| --- | --- |
| Brand navy / login panel / mark background | `#142B50` |
| Primary actions | `#1659D7` |
| Mint accent | `#68E7BF` |
| Main text | `#142037` |
| Page background | `#F5F7FB` |

Mint is an accent, not a text colour on white. Existing warning, error and attendance status colours remain meaningful; they are not replaced by the brand palette.

## Implementation

- `frontend/src/branding/brand.json`: shared name, tagline, description and browser theme colour.
- `frontend/src/branding/Brand.jsx`: wordmark, logo, loading screen and page-title helpers.
- `frontend/public/brand-mark.svg`: E monogram and browser favicon.
- `frontend/src/branding/brand.css`: branding and responsive login styles.
- `frontend/vite.config.js`: reads the shared configuration to generate browser metadata. `frontend/index.html` also retains a readable fallback title.
- Dashboards, institution onboarding and the classroom use the shared identity. Jitsi IFrame application-name options use the same name; provider-controlled branding is not guaranteed to disappear.

No stock imagery, fake users, statistics, testimonials, affiliations or feature claims were added. Existing routes, permissions and data workflows are preserved.

## Status

Implemented and deployed to the existing public Vercel site on 4 September 2026. The login is https://smart-virtual-lms-frontend-ruby.vercel.app/login. The repository and hosting project names remain unchanged. The accompanying institution update was deployed after a verified Neon backup and migration; see INSTITUTION_SETUP.md. No domain has been purchased, the HITAM custom domain is not connected, and trademark clearance is still pending.

Verification includes frontend production build, existing route/form rendering tests, brand text and page-title checks, metadata inspection, and preservation of separate institution name/logo rendering. Interactive browser and visual layout testing were not requested or performed.
