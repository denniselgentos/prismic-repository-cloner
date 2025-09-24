import {
  getRepositoryLanguages,
  detectDocumentLanguages,
  getDestinationToken,
} from "@/lib/assets";
import * as prismic from "@prismicio/client";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get source repository languages
    const sourceLanguages = await getRepositoryLanguages(
      process.env.Source_Repo,
      false
    );
    console.log("Source repository languages:", sourceLanguages);

    // Get destination repository languages
    const destinationLanguages = await getRepositoryLanguages(
      process.env.Destination_Repo,
      true
    );
    console.log("Destination repository languages:", destinationLanguages);

    // Get all documents to detect actual languages used
    const client = prismic.createClient(process.env.Source_Repo, {});
    const allDocuments = await client.dangerouslyGetAll();

    // Detect languages from documents
    const documentLanguages = detectDocumentLanguages(allDocuments);
    console.log("Languages detected in documents:", documentLanguages);

    // Find missing languages
    const missingLanguages = documentLanguages.filter(
      (lang) => !destinationLanguages.some((destLang) => destLang.id === lang)
    );

    // Create language mapping for instructions
    const languageInstructions = missingLanguages.map((lang) => {
      const sourceLangInfo = sourceLanguages.find((sl) => sl.id === lang);
      return {
        id: lang,
        name: sourceLangInfo?.name || lang,
        needsToBeAdded: true,
      };
    });

    return res.status(200).json({
      sourceLanguages,
      destinationLanguages,
      documentLanguages,
      missingLanguages,
      languageInstructions,
      instructions:
        missingLanguages.length > 0
          ? [
              "To fix language errors, you need to add the following languages to your destination repository:",
              ...missingLanguages.map((lang) => `- ${lang}`),
              "",
              "Steps to add languages:",
              "1. Go to your Prismic dashboard",
              "2. Navigate to Settings > Translations & Locales",
              "3. Add the missing languages listed above",
              "4. Save the changes",
              "5. Run the migration again",
            ]
          : [
              "All required languages are already configured in the destination repository!",
            ],
    });
  } catch (error) {
    console.error("Error checking languages:", error);
    return res.status(500).json({
      error: "Failed to check languages",
      details: error.message,
    });
  }
}
