import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "./generated/prisma/client";


const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    const url = process.env.DATABASE_URL;
    if(!url){
        throw new Error("Database Url Not Set");
    }
    // Neon's pooler can suspend idle computes and drop pooled connections.
    // TCP keepalive + a bounded idle window + a connect timeout keep the
    // client from hanging onto dead connections or waiting forever on a
    // cold start (which surfaces as P1001 "Can't reach database server").
    const adapter = new PrismaPg({
        connectionString: url,
        keepAlive: true,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 15_000,
    });
    return new  PrismaClient({adapter});
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if(process.env.NODE_ENV !== "production"){
    globalForPrisma.prisma = prisma;
}