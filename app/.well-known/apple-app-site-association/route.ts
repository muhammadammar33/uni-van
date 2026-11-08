/**
 * iOS Universal Links: lets hamsafar.website links open in the Hamsafar app on iPhone. Needs the Apple
 * Developer Team ID in APPLE_TEAM_ID. API calls and the admin panel stay on the web.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? "").trim();
  const body = /^[A-Z0-9]{10}$/.test(team)
    ? {
        applinks: {
          details: [
            {
              appIDs: [`${team}.website.hamsafar.app`],
              components: [
                { "/": "/api/*", exclude: true },
                { "/": "/admin*", exclude: true },
                { "/": "*" },
              ],
            },
          ],
        },
      }
    : { applinks: { details: [] } };
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
