import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";

// create a new instance of Router
export const matchRouter = Router();

const MAX_LIMIT = 100;

// to get to this path, we must use "/matches" first
// gives us the list of matches
matchRouter.get("/", async (req, res) => {
  // listMatchesQuerySchema ensures the query parameters we are passing in matches our schema
  // the schema comes from req.query
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  // if no parsed
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query",
      details: parsed.error.issues,
    });
  }

  // create a limit of how many matches in a single call e.g. 100
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);
  try {
    const result = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt)) // starting from new additions
      .limit(limit);

    // send result info to frontend
    res.json({ result });
  } catch (e) {
    console.error("Failed to list matches", e);
    res.status(500).json({ error: "Failed to list matches" });
  }
});

matchRouter.post("/", async (req, res) => {
  // first parse the data
  // createMatchSchema ensures the body we are passing in matches our schema
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.issues,
    });
  }

  // destructure data, startTime and endTime from parsed
  const { startTime, endTime, homeScore, awayScore } = parsed.data;
  try {
    // we are inserting the match into the matches database table
    // ...parsed.data, inputting all the data information using the ... spread
    // .returning() gets back the new data we passed in
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning();

    // this triggers a websocket broadcast whenever a match is created
    // sends info to all active connections
    try {
      res.app.locals.broadcastMatchCreated?.(event);
    } catch (e) {
      console.error("Failed to broadcast match_created", e);
    }

    // send info back to frontend
    res.status(201).json({ data: event });
  } catch (err) {
    console.error("Failed to create match", err);
    // status of 500 means server error
    res.status(500).json({ error: "Failed to create match" });
  }
});
