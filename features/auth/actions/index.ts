"use server"

import {auth} from "@/lib/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {DEFAULT_AUTH_CALLBACK, SIGN_IN_PATH, getSafeCallbackPath} from "../utils"

export async function signInWithGithub(formData: FormData) {
    const callback = formData.get("callbackUrl");
    const redirectTo = getSafeCallbackPath(
        typeof callback === "string" ? callback : null
    );
    const result  = await auth.api.signInSocial({
        body: {
            provider:"github",
            callbackURL: redirectTo
        },
        headers: await headers()
    });
    if(result.url){
        redirect(result.url)
    }
}

export async function getServerSession() {
    try {
        return await auth.api.getSession({
            headers: await headers()
        })
    } catch (error) {
        // A transient DB failure (e.g. a cold-started Neon compute) should
        // degrade to "signed out" instead of a 500 on every page.
        console.error("[auth] Failed to get session:", error);
        return null;
    }
}

export async function requiredAuth(redirectTo = SIGN_IN_PATH) {
    const session = await getServerSession();
    if(!session){
        redirect(redirectTo)
    }
    return session;
}
export async function requiredUnAuth(redirectTo = DEFAULT_AUTH_CALLBACK) {
    const session = await getServerSession();
    if(session){
        redirect(redirectTo)
    }
    return session;
}

