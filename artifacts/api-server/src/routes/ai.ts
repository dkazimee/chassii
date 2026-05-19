import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { carsTable, carModsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// POST /api/ai/cars/:carId/chat
// Streams an AI response based on the car's context and the user's messages
router.post("/ai/cars/:carId/chat", async (req, res) => {
  try {
    const carId = Number(req.params.carId);
    const { messages } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!carId || !messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "carId and messages are required" });
      return;
    }

    // Fetch car with its mods for context
    const car = await db.query.carsTable.findFirst({
      where: eq(carsTable.id, carId),
    });

    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }

    const mods = await db.query.carModsTable.findMany({
      where: eq(carModsTable.carId, carId),
    });

    // Build a detailed system prompt with the car's context
    const modsList = mods.length > 0
      ? mods.map(m => `  - ${m.name} (${m.category}, ${m.brand}${m.notes ? `: ${m.notes}` : ""})`).join("\n")
      : "  - No modifications (stock)";

    const systemPrompt = `You are an expert automotive mechanic and performance tuner with deep knowledge of all car makes and models, their common issues, modifications, and maintenance requirements. You are helping the owner of a specific car.

CAR DETAILS:
- Make: ${car.make}
- Model: ${car.model}
- Year: ${car.year}${car.generation ? `\n- Generation: ${car.generation}` : ""}${car.trim ? `\n- Trim: ${car.trim}` : ""}${car.engine ? `\n- Engine: ${car.engine}` : ""}${car.transmission ? `\n- Transmission: ${car.transmission}` : ""}${car.mileage ? `\n- Mileage: ${car.mileage.toLocaleString()} miles` : ""}${car.color ? `\n- Color: ${car.color}` : ""}

MODIFICATIONS:
${modsList}

${car.ownershipStory ? `OWNER'S NOTES:\n${car.ownershipStory}\n` : ""}

INSTRUCTIONS:
- You are specifically knowledgeable about this ${car.year} ${car.make} ${car.model} and its quirks, known issues, and common problems.
- Take into account the car's modifications when giving advice — a modified car behaves differently from stock.
- Give concrete, actionable advice. Be specific with part numbers, torque specs, or procedures when relevant.
- If you're unsure about something specific to this car, say so and recommend consulting a specialist.
- Keep responses focused and practical. Format clearly with bullet points when listing steps.
- You can discuss: diagnostics, troubleshooting, maintenance, performance tuning, mods, and general ownership questions.`;

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("AI chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI chat failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  }
});

export default router;
