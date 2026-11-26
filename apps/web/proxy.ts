import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Family app, staff console and account settings need sign-in. Staff roles and 2-step
// verification are enforced by the API on every request; this only sends signed-out
// visitors to the sign-in page.
const isProtected = createRouteMatcher(['/app(.*)', '/ops(.*)', '/account(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) await auth.protect();
});

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
