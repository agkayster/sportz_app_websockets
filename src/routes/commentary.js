import { Router } from "express";
import { matchIdParamSchema } from "../validation/matches.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

// GET request route
commentaryRouter.get("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: parsedParams.error.issues,
    });
  }

  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid query",
      details: parsedQuery.error.issues,
    });
  }

  const limit = Math.min(parsedQuery.data.limit ?? 100, MAX_LIMIT);

  try {
    // destructure the matchId from parsedParams.data
    // this is gotten from req.params that checks /matches/:id/commentary
    const { id: matchId } = parsedParams.data;
    const result = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ result });
  } catch (e) {
    console.error("Failed to list commentary", e);
    res.status(500).json({ error: "Failed to list commentary" });
  }
});

// POST request route
commentaryRouter.post("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: parsedParams.error.issues,
    });
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsedBody.error.issues,
    });
  }

  try {
    const [result] = await db
      .insert(commentary)
      .values({
        ...parsedBody.data,
        matchId: parsedParams.data.id,
      })
      .returning();

    res.status(201).json({ data: result });
  } catch (err) {
    console.error("Failed to create commentary", err);
    res.status(500).json({ error: "Failed to create commentary" });
  }
});
