import {
  getRepositoryLanguages,
  getDestinationToken,
  getReadToken,
} from "@/lib/assets";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("=== TESTING LANGUAGE DETECTION ===");

    // Test source repository with read token
    console.log("Testing source repository...");
    const sourceLanguages = await getRepositoryLanguages(
      process.env.Source_Repo,
      false
    );
    console.log("Source languages result:", sourceLanguages);

    // Test destination repository with write API key
    console.log("Testing destination repository with write API key...");
    try {
      const destLanguagesWithApiKey = await getRepositoryLanguages(
        process.env.Destination_Repo,
        false
      );
      console.log(
        "Destination languages with API key:",
        destLanguagesWithApiKey
      );
    } catch (apiKeyError) {
      console.error("Error with API key approach:", apiKeyError.message);
    }

    // Test destination repository with authenticated token
    console.log("Testing destination repository with authenticated token...");
    try {
      const destLanguagesWithToken = await getRepositoryLanguages(
        process.env.Destination_Repo,
        true
      );
      console.log("Destination languages with token:", destLanguagesWithToken);
    } catch (tokenError) {
      console.error(
        "Error with authenticated token approach:",
        tokenError.message
      );
    }

    // Try fetching destination repo info without any auth
    console.log("Testing destination repository without auth...");
    try {
      const response = await fetch(
        `https://${process.env.Destination_Repo}.cdn.prismic.io/api/v2`
      );
      const data = await response.json();
      console.log("Destination languages without auth:", data.languages);
    } catch (noAuthError) {
      console.error("Error without auth:", noAuthError.message);
    }

    return res.status(200).json({
      message: "Language test complete - check console logs",
      sourceRepo: process.env.Source_Repo,
      destinationRepo: process.env.Destination_Repo,
    });
  } catch (error) {
    console.error("Test failed:", error);
    return res.status(500).json({
      error: "Test failed",
      details: error.message,
    });
  }
}
