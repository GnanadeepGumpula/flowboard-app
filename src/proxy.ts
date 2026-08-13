import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/projects", "/boards", "/shared", "/settings"];
const publicPaths = ["/login", "/signup", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. CRITICAL: Bypass callback route completely so middleware does not interfere with PKCE code exchange
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));
  const isProtectedPath = protectedPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();

  // 2. Redirect unauthenticated users trying to access protected paths to /login
  if (!data.user && isProtectedPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Redirect authenticated users away from public pages (except /reset-password)
  if (data.user && isPublicPath && pathname !== "/reset-password") {
    const nextPath = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(new URL(nextPath || "/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};