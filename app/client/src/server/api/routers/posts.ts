import { clerkClient } from "@clerk/nextjs"
import {
    createTRPCRouter,
    privateProcedure,
    publicProcedure,
} from "~/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { type User } from "@clerk/nextjs/dist/types/server/clerkClient"
import { z } from "zod"
import { filterUserForClient } from "~/server/helpers/filterUserForClients"

export const postsRouter = createTRPCRouter({
    getAll: publicProcedure.query(async ({ ctx }) => {
        const posts = await ctx.prisma.post.findMany({
            take: 100,
            orderBy: [{ createdAt: "desc" }],
        })

        // ** way to filter desired response from the api
        const users = (
            await clerkClient.users.getUserList({
                userId: posts.map((post) => post.authorId),
                limit: 100,
            })
        ).map(filterUserForClient)

        console.log(users)

        return posts.map((post) => {
            const author = users.find((u) => u.id === post.authorId)

            if (!author || !author.username) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Author for post not found",
                })
            }

            return {
                post,
                author: {
                    ...author,
                    username: author.username,
                },
            }
        })
    }),

    getPostByUserId: publicProcedure
        .input(
            z.object({
                userId: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            await ctx.prisma.post.findMany({
                where: {
                    authorId: input.userId,
                },
                take: 100,
                orderBy: [
                    {
                        createdAt: "desc",
                    },
                ],
            })
        }),

    create: privateProcedure
        .input(
            z.object({
                content: z
                    .string()
                    .emoji("Only emojis are allowed.")
                    .min(1)
                    .max(280),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const authorId = ctx.userId

            const post = await ctx.prisma.post.create({
                data: {
                    authorId: !authorId ? "" : authorId,
                    content: input.content,
                },
            })

            return post
        }),
})