import fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
dotenv.config();

const app = fastify();
const prisma = new PrismaClient();

app.register(sensible);
app.register(cors, {
  origin: process.env.CLIENT_URL,
  credentials: true,
});
app.register(cookie, { secret: process.env.COOKIE_SECRET });

app.addHook("onRequest", (req, res, done) => {
  if (req.cookies.userId !== CURRENT_USER_ID) {
    req.cookies.userId = CURRENT_USER_ID;
    res.clearCookie("userId");
    res.setCookie("userId", CURRENT_USER_ID);
  }
  done();
});

app.get("/posts", async (req, res) => {
  try {
    const data = await prisma.post.findMany({
      select: {
        id: true,
        title: true,
      },
    });
    res.send(data);
  } catch (error) {
    res.send(app.httpErrors.internalServerError(error.message));
  }
});

const CURRENT_USER_ID = (async () => {
  const user = await prisma.user.findFirst({ where: { name: "Kyle" } });
  return user.id;
})();

const COMMENT_SELECT_FIELDS = {
  id: true,
  message: true,
  parentId: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
};

app.get("/posts/:id", async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        body: true,
        title: true,
        comments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            ...COMMENT_SELECT_FIELDS,
            _count: { select: { likes: true } },
          },
        },
      },
    });

    const likes = await prisma.like.findMany({
      where: {
        userId: req.cookies.userId,
        commentId: { in: post.comments.map(comment => comment.id) },
      },
    });

    const data = {
      ...post,
      comments: post.comments.map(comment => {
        const { _count, ...commentFields } = comment;
        return {
          ...commentFields,
          likedByMe: likes.find(like => like.commentId === comment.id),
          likeCount: _count.likes,
        };
      }),
    };

    res.send(data);
  } catch (error) {
    res.send(app.httpErrors.internalServerError(error.message));
  }
});

app.post("/posts/:id/comments", async (req, res) => {
  if (req.body.message === "" || req.body.message == null) {
    return res.code(400).send("Message is required");
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        message: req.body.message,
        userId: req.cookies.userId,
        parentId: req.body.parentId,
        postId: req.params.id,
      },
      select: COMMENT_SELECT_FIELDS,
    });

    const data = {
      ...comment,
      likeCount: 0,
      likedByMe: false,
    };

    res.send(data);
  } catch (error) {
    res.send(app.httpErrors.internalServerError(error.message));
  }
});

app.put("/posts/:postId/comments/:commentId", async (req, res) => {
  if (req.body.message === "" || req.body.message == null) {
    return res.code(400).send("Message is required");
  }

  try {
    const { userId } = await prisma.comment.findUnique({
      where: { id: req.params.commentId },
      select: { userId: true },
    });

    if (userId !== req.cookies.userId) {
      return res
        .code(401)
        .send("You do not have permission to edit this message");
    }

    const comment = await prisma.comment.update({
      where: { id: req.params.commentId },
      data: { message: req.body.message },
      select: { message: true },
    });

    res.send(comment);
  } catch (error) {
    res.send(app.httpErrors.internalServerError(error.message));
  }
});

app.delete("/posts/:postId/comments/:commentId", async (req, res) => {
  try {
    const { userId } = await prisma.comment.findUnique({
      where: { id: req.params.commentId },
      select: { userId: true },
    });

    if (userId !== req.cookies.userId) {
      return res
        .code(401)
        .send("You do not have permission to delete this message");
    }

    await prisma.comment.delete({
      where: { id: req.params.commentId },
    });

    res.send({ message: "Comment deleted successfully" });
  } catch (error) {
    res.send(app.httpErrors.internalServerError(error.message));
  }
});

app.post("/posts/:postId/comments/:commentId/toggleLike", async (req, res) => {
  const data = {
    commentId: req.params.commentId,
    userId: req.cookies.userId,
  };

  // Check if userId is a valid string
  if (typeof data.userId !== "string" || data.userId.trim() === "") {
    return res.code(401).send("User not authenticated or invalid userId");
  }

  try {
    const like = await prisma.like.findUnique({
      where: { userId_commentId: data },
    });

    if (like == null) {
      await prisma.like.create({ data });
      res.send({ addLike: true });
    } else {
      await prisma.like.delete({ where: { userId_commentId: data } });
      res.send({ addLike: false });
    }
  } catch (error) {
    res.send(app.httpErrors.internalServerError(error.message));
  }
});

const start = async () => {
  try {
    await prisma.$connect();
    await app.listen(process.env.PORT);
    console.log(`Server is listening on port ${process.env.PORT}`);
  } catch (error) {
    console.error("Error starting the server:", error);
  }
};

start();
