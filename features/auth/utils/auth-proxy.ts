import {auth} from "@/lib/auth";
import {getSafeCallbackPath, SIGN_IN_PATH} from "./index";
import {NextRequest, NextResponse} from "next/server";

function redirectToSignIn(request: NextRequest, pathname: string) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);

    signInUrl.searchParams.set(
        "callbackUrl",
        `${pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(signInUrl);
}

function getPostAuthRedirectPath(request: NextRequest): string {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
    return getSafeCallbackPath(callbackUrl);
}

async function getSessionSafe(request: NextRequest) {
    try {
        return await auth.api.getSession({
            headers: request.headers
        });
    } catch (error) {
        // Database briefly unreachable (e.g. Neon cold start): treat as
        // signed out instead of failing every dashboard request with a 500.
        console.error("[auth-proxy] Failed to get session:", error);
        return null;
    }
}

export async function handleAuthProxy(request:NextRequest) {
    const {pathname} = request.nextUrl;
    if(pathname === "/"){
        return NextResponse.next();
    } 
    const session = await getSessionSafe(request);

    if(pathname === SIGN_IN_PATH){
        if(session){
            const redirectPath = getPostAuthRedirectPath(request);
            return NextResponse.redirect(new URL(redirectPath, request.url));
        }
        return NextResponse.next()
    }
    if(!session){
        return redirectToSignIn(request, pathname)
    }
    return NextResponse.next();
}