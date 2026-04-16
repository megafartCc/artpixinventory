import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: "Mock Account",
      credentials: {
        role: { label: "Role", type: "text", placeholder: "admin/manager/purchaser/warehouse" }
      },
      async authorize(credentials) {
        if (!credentials?.role) return null;
        
        let targetEmail = "";
        switch (credentials.role.toLowerCase()) {
          case 'admin': targetEmail = "admin@artpix3d.com"; break;
          case 'manager': targetEmail = "manager@artpix3d.com"; break;
          case 'purchaser': targetEmail = "purchasing@artpix3d.com"; break;
          case 'warehouse': targetEmail = "warehouse@artpix3d.com"; break;
          default: return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: targetEmail }
        });

        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role, // Attach role to token
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    }
  }
};
