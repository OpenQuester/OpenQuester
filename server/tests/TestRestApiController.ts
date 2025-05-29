import { Router, type Express, type Request, type Response } from "express";

export class TestRestApiController {
  constructor(private readonly app: Express) {
    const router = Router();
    this.app.use("/v1/test", router);

    // Login as a user by ID, set session
    router.post("/login", async (req: Request, res: Response) => {
      if (!req.session) {
        return res
          .status(500)
          .json({ error: "Session middleware not initialized" });
      }
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });
      req.session.userId = userId;
      req.session.save((err: any) => {
        if (err) return res.status(500).json({ error: "Session error" });
        // Return the session cookie as set by express-session
        res.status(200).json({ success: true });
      });
    });
  }
}
