import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const SYSTEM_PROMPT =
  "You are a medical text normalizer. The user will provide raw triage symptoms with possible spelling errors, abbreviations, or shorthand (e.g., \"sever hedek\", \"sob\"). Return a raw JSON array of standardized, correctly spelled medical symptoms (e.g., [\"Severe Headache\", \"Shortness of Breath\"]). Do not include markdown formatting, backticks, or explanations. Only output the JSON array.";

/**
 * Uses an LLM to normalize raw symptom strings into clean, standardised
 * medical terminology.
 *
 * **Fail-safe:** if the API call fails, times out, or the response cannot
 * be parsed as a JSON string array, the original `rawSymptoms` are returned
 * unchanged so triage is never blocked.
 */
export async function normalizeSymptoms(
  rawSymptoms: string[],
  notes?: string,
): Promise<string[]> {
  try {
    let userContent = `Symptoms: ${rawSymptoms.join(", ")}`;
    if (notes) {
      userContent += `\nNotes: ${notes}`;
    }

    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 512,
    });

    let raw = response.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.warn("[nlpParser] Empty LLM response — falling back to raw symptoms");
      return rawSymptoms;
    }

    // Strip markdown backticks if the LLM ignores instructions
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    const parsed = JSON.parse(raw);

    if (
      !Array.isArray(parsed) ||
      !parsed.every((item: unknown) => typeof item === "string")
    ) {
      console.warn("[nlpParser] LLM returned non-string-array JSON — falling back to raw symptoms");
      return rawSymptoms;
    }

    console.log("[nlpParser] Normalised symptoms:", parsed);
    return parsed as string[];
  } catch (error) {
    console.error("[nlpParser] LLM normalisation failed — falling back to raw symptoms:", error);
    return rawSymptoms;
  }
}
